import { NextRequest } from "next/server";
import Meting from "@meting/core";
import { errors } from "@/server/http/errors";
import { handle } from "@/server/http/handler";
import { getClientIp } from "@/server/http/ip";
import { enforceRateLimit } from "@/server/http/rate-limit";
import { TtlCache } from "@/server/http/ttl-cache";

interface SongData {
  id: string;
  title: string;
  artist: string;
  cover: string;
  src: string;
  lrcUrl: string;
}

interface Track {
  id: string;
  name: string;
  artist: string[];
  pic_id: string;
  url_id: string;
  lyric_id: string;
}

/**
 * /api/music 的响应体。
 * 从前这里直接返回 SongData[]，但「上游失败」「歌单不可播」「没配置」三种情况
 * 都会退化成空数组，前台只能显示「暂无音乐」。现在把统计与原因一起返回，
 * 前台可以据此给出可操作的提示。
 */
interface MusicResponse {
  songs: SongData[];
  /** 网易云返回的曲目总数（歌单可能被截断，见 MAX_PLAYLIST_TRACKS）。 */
  total: number;
  /** 有曲目但拿不到播放地址而被跳过的数量。 */
  skipped: number;
  source: "playlist" | "ids";
  /** 为空数组时给前台的提示；正常返回时是空字符串。 */
  message: string;
}

const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX_ENTRIES = 100;
const MAX_SONG_IDS = 50;
/** 歌单可能上千首，逐首换取播放地址太慢，只解析前 N 首。 */
const MAX_PLAYLIST_TRACKS = 100;
/** 对网易云的并发请求数，避免一次性打出上百个 eapi 请求。 */
const RESOLVE_CONCURRENCY = 6;
/**
 * 海外部署时的兜底音源：服务器直接找网易云常常拿不到地址（地区版权限制），
 * 但这个公开 Meting 接口会 302 到可播放的 mp3，且重定向发生在用户浏览器侧，
 * 签署参数按访客自己的 IP 生成，因此不受服务器所在地区影响。
 * 只在直连拿不到地址、且它能解析出来时才使用。
 */
const FALLBACK_SOURCE_API = "https://api.injahow.cn/meting";
const FALLBACK_PROBE_TIMEOUT_MS = 8000;
/**
 * 整批曲目的兜底探测预算。歌单可能有上百首、每首都要探测一次，
 * 超过这个时间就不再探测（该首按不可播放处理），避免请求无限拖长。
 */
const FALLBACK_PROBE_BUDGET_MS = 15_000;

const EMPTY_MESSAGE_PLAYLIST =
  "没有从网易云取到歌曲，请确认歌单 ID 是否正确、歌单是否为空。";
const EMPTY_MESSAGE_IDS = "没有从网易云取到歌曲，请确认歌曲 ID 是否正确。";

const cache = new TtlCache<MusicResponse>(CACHE_TTL_MS, CACHE_MAX_ENTRIES);

function parseQuery(request: NextRequest): {
  playlistId?: string;
  songIds?: string[];
} {
  const params = request.nextUrl.searchParams;
  const playlistId = params.get("id")?.trim();
  const songIds = params.get("ids")?.trim();

  if (!playlistId && !songIds) {
    throw errors.badRequest("需要提供 id (歌单ID) 或 ids (歌曲ID,逗号分隔)");
  }

  if (playlistId && !/^\d{1,20}$/.test(playlistId)) {
    throw errors.badRequest("歌单 ID 必须是数字");
  }

  if (songIds) {
    const ids = songIds
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    if (ids.length === 0 || ids.length > MAX_SONG_IDS) {
      throw errors.badRequest(`一次最多查询 ${MAX_SONG_IDS} 首歌曲`);
    }
    if (ids.some((value) => !/^\d{1,20}$/.test(value))) {
      throw errors.badRequest("歌曲 ID 必须是数字");
    }
    return { playlistId, songIds: ids };
  }

  return { playlistId };
}

/** 固定并发数的 map，保持结果顺序。 */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const size = Math.min(Math.max(1, limit), items.length);
  const runners = Array.from({ length: size }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index]);
    }
  });
  await Promise.all(runners);
  return results;
}

function toHttps(url: string | undefined): string {
  return (url || "").replace(/^http:\/\//, "https://");
}

function fallbackSource(urlId: string): string {
  return `${FALLBACK_SOURCE_API}/?server=netease&type=url&id=${encodeURIComponent(urlId)}`;
}

/**
 * 用公开 Meting 接口换取网易云 CDN 的直达地址。
 * 服务器所在地区直连 geteapi 拿不到地址，但公开接口会 302 到 *.music.126.net 的签名地址，
 * 该签名不绑定请求方 IP，浏览器可以直接播放，所以我们把它解析出来交给前端，
 * 而不是把第三方接口地址塞进 <audio src>。拿不准时返回 null，宁可不给坏链接。
 */
async function fallbackAudioSrc(urlId: string, deadline: number): Promise<string | null> {
  if (Date.now() > deadline) return null;
  try {
    const response = await fetch(fallbackSource(urlId), {
      method: "HEAD",
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(FALLBACK_PROBE_TIMEOUT_MS),
    });
    if (response.status < 300 || response.status >= 400) return null;
    const location = response.headers.get("location") || "";
    // 不可播的曲目公开接口回 200 空体；只有 3xx 且落在网易云 CDN 才算真的能播。
    return /^https:\/\/[^/]*music\.126\.net\//.test(location) ? location : null;
  } catch {
    return null;
  }
}

async function loadTracks(
  meting: Meting,
  target: { playlistId?: string; songIds?: string[] },
): Promise<Track[]> {
  if (target.playlistId) {
    const raw = await meting.playlist(target.playlistId);
    const parsed = JSON.parse(raw as string) as unknown;
    return Array.isArray(parsed) ? (parsed as Track[]) : [];
  }

  if (!target.songIds) return [];

  const results = await mapWithConcurrency(
    target.songIds,
    RESOLVE_CONCURRENCY,
    async (id) => {
      try {
        const raw = await meting.song(id);
        const parsed = JSON.parse(raw as string) as unknown;
        if (Array.isArray(parsed)) return parsed as Track[];
        return parsed ? [parsed as Track] : [];
      } catch {
        // 单首歌取不到不影响其它歌。
        return [] as Track[];
      }
    },
  );
  return results.flat();
}

async function resolveTrack(
  meting: Meting,
  track: Track,
  probeDeadline: number,
): Promise<SongData> {
  let src = "";
  try {
    const urlRaw = await meting.url(track.url_id, 320);
    const urlData = JSON.parse(urlRaw as string) as { url?: string };
    src = toHttps(urlData.url);
  } catch {
    // 单首不可播不应拖垮整个歌单，下面统计后会给出提示。
  }

  if (!src && track.url_id) {
    src = (await fallbackAudioSrc(track.url_id, probeDeadline)) ?? "";
  }

  let cover = "";
  try {
    const picRaw = await meting.pic(track.pic_id, 300);
    const picData = JSON.parse(picRaw as string) as { url?: string };
    cover = toHttps(picData.url);
  } catch {
    // 封面可选。
  }

  return {
    id: String(track.id),
    title: track.name || "未知歌曲",
    artist: Array.isArray(track.artist)
      ? track.artist.join(", ")
      : String(track.artist || "未知歌手"),
    cover,
    src,
    lrcUrl: track.lyric_id
      ? `https://api.injahow.cn/meting/?server=netease&type=lrc&id=${track.lyric_id}`
      : "",
  };
}

async function resolveSongs(target: {
  playlistId?: string;
  songIds?: string[];
}): Promise<MusicResponse> {
  const meting = new Meting("netease");
  meting.format(true);
  const source: MusicResponse["source"] = target.playlistId ? "playlist" : "ids";

  let tracks: Track[];
  try {
    tracks = await loadTracks(meting, target);
  } catch {
    throw errors.upstream("获取音乐数据失败");
  }

  const total = tracks.length;
  const limited = tracks.slice(0, MAX_PLAYLIST_TRACKS);
  const probeDeadline = Date.now() + FALLBACK_PROBE_BUDGET_MS;
  const resolved = await mapWithConcurrency(limited, RESOLVE_CONCURRENCY, (track) =>
    resolveTrack(meting, track, probeDeadline),
  );
  const songs = resolved.filter((song) => song.src);
  const skipped = resolved.length - songs.length;

  let message = "";
  if (songs.length === 0) {
    if (total === 0) {
      message = source === "playlist" ? EMPTY_MESSAGE_PLAYLIST : EMPTY_MESSAGE_IDS;
    } else {
      // 海外服务器常见：曲目在国内可播、到服务器所在地区就是空地址，
      // 所以文案要同时提地区限制，不要一口咬定「歌没了」。
      message = `这 ${total} 首歌在网易云都不可播放（可能无版权、已下架，或受服务器所在地区的版权限制）。换一个歌单或歌曲 ID 试试。`;
    }
  } else if (skipped > 0) {
    message = `已跳过 ${skipped} 首不可播放的歌曲。`;
  }

  return { songs, total, skipped, source, message };
}

export async function GET(request: NextRequest) {
  return handle(
    async () => {
      const ip = getClientIp(request);
      enforceRateLimit(`music:${ip}`, 30, 60_000);

      const target = parseQuery(request);
      const cacheKey = target.playlistId
        ? `playlist:${target.playlistId}`
        : `songs:${target.songIds?.join(",")}`;

      const cached = cache.get(cacheKey);
      if (cached) {
        return Response.json(cached, {
          headers: {
            "cache-control": "public, max-age=600, stale-while-revalidate=3600",
          },
        });
      }

      const payload = await resolveSongs(target);
      const empty = payload.songs.length === 0;

      // 空结果不写缓存：歌单补版权、配置修正后应当立刻生效，
      // 这也是之前「配了歌单却一直显示暂无音乐」的原因之一。
      if (!empty) {
        cache.set(cacheKey, payload);
      }

      return Response.json(payload, {
        headers: {
          "cache-control": empty
            ? "no-store"
            : "public, max-age=600, stale-while-revalidate=3600",
        },
      });
    },
    { request },
  );
}
