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

const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new TtlCache<SongData[]>(CACHE_TTL_MS, 100);

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
    if (ids.length === 0 || ids.length > 50) {
      throw errors.badRequest("一次最多查询 50 首歌曲");
    }
    if (ids.some((value) => !/^\d{1,20}$/.test(value))) {
      throw errors.badRequest("歌曲 ID 必须是数字");
    }
    return { playlistId, songIds: ids };
  }

  return { playlistId };
}

async function resolveSongs(target: {
  playlistId?: string;
  songIds?: string[];
}): Promise<SongData[]> {
  const meting = new Meting("netease");
  meting.format(true);

  let tracks: Track[] = [];
  try {
    if (target.playlistId) {
      const raw = await meting.playlist(target.playlistId);
      const parsed = JSON.parse(raw as string) as unknown;
      tracks = Array.isArray(parsed) ? (parsed as Track[]) : [];
    } else if (target.songIds) {
      const results = await Promise.all(
        target.songIds.map(async (id) => {
          try {
            const raw = await meting.song(id);
            const parsed = JSON.parse(raw as string) as unknown;
            return Array.isArray(parsed) ? (parsed as Track[]) : [parsed as Track];
          } catch {
            return [];
          }
        }),
      );
      tracks = results.flat();
    }
  } catch {
    throw errors.upstream("获取音乐数据失败");
  }

  const songs = await Promise.all(
    tracks.map(async (track) => {
      let src = "";
      try {
        const urlRaw = await meting.url(track.url_id, 320);
        const urlData = JSON.parse(urlRaw as string) as { url?: string };
        src = (urlData.url || "").replace(/^http:\/\//, "https://");
      } catch {
        // A single unavailable track should not fail the whole playlist.
      }

      let cover = "";
      try {
        const picRaw = await meting.pic(track.pic_id, 300);
        const picData = JSON.parse(picRaw as string) as { url?: string };
        cover = (picData.url || "").replace(/^http:\/\//, "https://");
      } catch {
        // Cover art is optional.
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
      } satisfies SongData;
    }),
  );

  return songs.filter((song) => song.src);
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

      const songs = await resolveSongs(target);
      cache.set(cacheKey, songs);

      return Response.json(songs, {
        headers: {
          "cache-control": "public, max-age=600, stale-while-revalidate=3600",
        },
      });
    },
    { request },
  );
}
