"use client";

import { createContext, useContext, useState, useRef, useEffect, useCallback, ReactNode } from "react";
import { useSiteSettings } from "@/components/providers/SiteSettingsProvider";
import { useDeferredActivation } from "@/lib/useDeferredActivation";

function parseLrc(lrcText: string) {
  if (!lrcText || lrcText.length > 30000) return [];
  const lines = lrcText.split(/\r?\n/);
  const result: { time: number; text: string }[] = [];
  for (const line of lines) {
    const matches = [...line.matchAll(/\[(\d{2,}):(\d{2})(?:\.(\d{2,3}))?\]/g)];
    if (matches.length > 0) {
      const text = line
        .replace(/\[\d{2,}:\d{2}(?:\.\d{2,3})?\]/g, "")
        .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200d\ufeff]/g, "")
        .trim();
      if (text) {
        for (const match of matches) {
          const min = parseInt(match[1]);
          const sec = parseInt(match[2]);
          const ms = match[3] ? parseInt(match[3]) : 0;
          const divisor = match[3] && match[3].length === 3 ? 1000 : 100;
          result.push({ time: min * 60 + sec + ms / divisor, text });
        }
      }
    }
  }
  return result.sort((a, b) => a.time - b.time);
}

type PlayMode = "loop" | "single" | "random";

interface Song {
  id: string;
  title: string;
  artist: string;
  cover: string;
  src: string;
  lrcUrl: string;
  lyrics: { time: number; text: string }[];
}

interface MusicContextType {
  playlist: Song[];
  currentIndex: number;
  currentSong: Song | undefined;
  isPlaying: boolean;
  progress: number;
  currentTime: number;
  duration: number;
  currentLyric: string;
  allLyrics: { time: number; text: string }[];
  isLoading: boolean;
  /** 拉取歌单失败或歌单不可播时给出的提示；正常情况下为 null。 */
  error: string | null;
  volume: number;
  isMuted: boolean;
  playMode: PlayMode;
  saying: string;
  refreshSaying: () => void;
  togglePlay: () => void;
  nextSong: () => void;
  prevSong: () => void;
  handleSeek: (value: number) => void;
  playSong: (index: number) => void;
  setVolume: (value: number) => void;
  toggleMute: () => void;
  togglePlayMode: () => void;
}

const MusicContext = createContext<MusicContextType | null>(null);

export function MusicProvider({ children }: { children: ReactNode }) {
  const { music } = useSiteSettings();
  const active = useDeferredActivation();
  const [playlist, setPlaylist] = useState<Song[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [lyrics, setLyrics] = useState<{ time: number; text: string }[]>([]);
  const [currentLyric, setCurrentLyric] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolumeState] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [playMode, setPlayMode] = useState<PlayMode>("loop");
  const [saying, setSaying] = useState("");
  const audioRef = useRef<HTMLAudioElement>(null);
  const playModeRef = useRef(playMode);
  const nextSongRef = useRef<() => void>(() => {});

  // Fetch saying once on mount
  const refreshSaying = useCallback(() => {
    fetch("https://uapis.cn/api/v1/saying")
      .then((r) => r.json())
      .then((d) => { if (d?.text) setSaying(d.text); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!active) return;
    refreshSaying();
  }, [active, refreshSaying]);

  // Fetch playlist from local API (uses @meting/core on server)
  useEffect(() => {
    if (!active) return;

    let mounted = true;
    const fetchMusicData = async () => {
      try {
        // 歌单配置来自后台「站点设置」，随布局一起下发，无需再单独请求。
        const playlistId = music.playlistId;
        const musicIds = music.trackIds;

        let apiUrl = "";
        if (playlistId) {
          apiUrl = `/api/music?id=${playlistId}`;
        } else if (musicIds.length > 0) {
          apiUrl = `/api/music?ids=${musicIds.join(",")}`;
        }

        if (!apiUrl) {
          if (mounted) setIsLoading(false);
          return;
        }

        const res = await fetch(apiUrl);
        const data = (await res.json()) as unknown;

        if (!res.ok) {
          const failure = data as { error?: { message?: string } } | null;
          if (mounted) {
            setError(failure?.error?.message ?? "音乐接口请求失败，请稍后重试");
            setIsLoading(false);
          }
          return;
        }

        // 接口现在返回 { songs, total, skipped, source, message }；
        // 兼容旧版的纯数组响应。
        const payload = data as { songs?: unknown; message?: unknown } | null;
        const rawSongs = Array.isArray(data)
          ? data
          : Array.isArray(payload?.songs)
            ? payload.songs
            : [];
        const hostMessage =
          !Array.isArray(data) && typeof payload?.message === "string"
            ? payload.message
            : "";

        const songs = rawSongs
          .map((r: Record<string, string>) => ({
            id: String(r.id || Math.random()),
            title: String(r.title || r.name || "未知歌曲"),
            artist: String(r.artist || r.author || "未知歌手"),
            cover: String(r.cover || r.pic || ""),
            src: String(r.src || r.url || ""),
            lrcUrl: String(r.lrcUrl || r.lrc || ""),
            lyrics: [] as { time: number; text: string }[],
          }))
          .filter((s) => s.src);

        if (mounted) {
          if (songs.length > 0) setPlaylist(songs);
          setError(songs.length === 0 ? hostMessage || "没有可播放的音乐" : null);
          setIsLoading(false);
        }
      } catch {
        if (mounted) {
          setError("音乐加载失败，请检查网络后重试");
          setIsLoading(false);
        }
      }
    };
    fetchMusicData();
    return () => { mounted = false; };
  }, [active, music]);

  // Fetch lyrics when song changes
  useEffect(() => {
    if (playlist.length === 0) return;
    const song = playlist[currentIndex];
    if (!song) return;
    let mounted = true;
    // eslint-disable-next-line
    setLyrics([]);
    setCurrentLyric("");

    if (song.lrcUrl) {
      fetch(song.lrcUrl)
        .then((r) => r.text())
        .then((text) => {
          if (!mounted) return;
          const parsed = parseLrc(text);
          setLyrics(parsed);
          setPlaylist((prev) => {
            const next = [...prev];
            next[currentIndex] = { ...next[currentIndex], lyrics: parsed };
            return next;
          });
        })
        .catch(() => {});
    }

    if (isPlaying && audioRef.current) {
      audioRef.current.play().catch(() => setIsPlaying(false));
    }
    return () => { mounted = false; };
  }, [currentIndex, playlist.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync volume
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) audioRef.current.pause();
    else audioRef.current.play().catch(() => {});
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const nextSong = useCallback(() => {
    if (playMode === "random") {
      setCurrentIndex(Math.floor(Math.random() * playlist.length));
    } else {
      setCurrentIndex((p) => (p + 1) % playlist.length);
    }
  }, [playMode, playlist.length]);

  useEffect(() => { playModeRef.current = playMode; }, [playMode]);
  useEffect(() => { nextSongRef.current = nextSong; }, [nextSong]);

  const prevSong = useCallback(() => {
    if (playMode === "random") {
      setCurrentIndex(Math.floor(Math.random() * playlist.length));
    } else {
      setCurrentIndex((p) => (p - 1 + playlist.length) % playlist.length);
    }
  }, [playMode, playlist.length]);

  const playSong = useCallback((index: number) => {
    setCurrentIndex(index);
    setIsPlaying(true);
  }, []);

  const handleTimeUpdate = useCallback(() => {
    if (!audioRef.current) return;
    const ct = audioRef.current.currentTime;
    const dur = audioRef.current.duration || 0;
    setCurrentTime(ct);
    setDuration(dur);
    setProgress(dur > 0 ? (ct / dur) * 100 : 0);
    if (lyrics.length > 0) {
      const active = [...lyrics].reverse().find((l) => ct >= l.time);
      if (active) setCurrentLyric(active.text);
    }
  }, [lyrics]);

  const handleEnded = useCallback(() => {
    if (playModeRef.current === "single" && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
    } else {
      nextSongRef.current();
    }
  }, []);

  const handleSeek = useCallback((value: number) => {
    setProgress(value);
    if (audioRef.current?.duration) {
      audioRef.current.currentTime = (value / 100) * audioRef.current.duration;
    }
  }, []);

  const setVolume = useCallback((val: number) => {
    setVolumeState(val);
    if (isMuted && val > 0) setIsMuted(false);
  }, [isMuted]);

  const toggleMute = useCallback(() => setIsMuted((p) => !p), []);

  const togglePlayMode = useCallback(() => {
    setPlayMode((p) => (p === "loop" ? "single" : p === "single" ? "random" : "loop"));
  }, []);

  return (
    <MusicContext.Provider
      value={{
        playlist, currentIndex, currentSong: playlist[currentIndex],
        isPlaying, progress, currentTime, duration,
        currentLyric, allLyrics: lyrics, isLoading, error,
        volume, isMuted, playMode, saying, refreshSaying,
        togglePlay, nextSong, prevSong, handleSeek, playSong,
        setVolume, toggleMute, togglePlayMode,
      }}
    >
      {children}
      {playlist[currentIndex] && (
        <audio
          ref={audioRef}
          src={playlist[currentIndex].src}
          preload="none"
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
          onLoadedMetadata={handleTimeUpdate}
        />
      )}
    </MusicContext.Provider>
  );
}

export function useMusic() {
  const ctx = useContext(MusicContext);
  if (!ctx) throw new Error("useMusic must be used within MusicProvider");
  return ctx;
}
