import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Song } from "../../lib/subsonic/client";
import { coverArtUrl, getRandomSongs, getSimilarSongs, streamUrl } from "../../lib/subsonic/client";
import { useSettings } from "../settings/SettingsContext";
import { useMediaSession } from "./useMediaSession";

export interface PlayerTrack extends Song {
  coverUrl?: string;
}

export interface PlaybackSource {
  kind: "playlist" | "album" | "search" | "queue";
  id?: string;
  name?: string;
}

export type RepeatMode = "off" | "all" | "one";
export type LyricsMode = "off" | "side" | "full";
export type AutoDjMode = "similar" | "random";

/** Volume moves in 5% notches so the readout is always a round number. */
export const VOLUME_STEP = 0.05;

function snapVolume(v: number): number {
  const clamped = Math.min(1, Math.max(0, v));
  return Math.round(clamped / VOLUME_STEP) * VOLUME_STEP;
}

interface PlaybackSessionPayload {
  queue: PlayerTrack[];
  currentIndex: number;
  positionMs: number;
  volume: number;
  shuffle: boolean;
  repeat: RepeatMode;
  queuePanelOpen: boolean;
  wasPlaying: boolean;
  source: PlaybackSource | null;
  lastPath: string;
}

function artistKey(track: PlayerTrack): string {
  return (track.artistId || track.artist || "").toLowerCase();
}

function albumKey(track: PlayerTrack): string {
  return (track.albumId || track.album || "").toLowerCase();
}

/** Score a candidate so the same artist/album are spaced out, with entropy so it still feels shuffled. */
function scoreTrack(track: PlayerTrack, recent: PlayerTrack[], picked: PlayerTrack[]): number {
  let score = Math.random() * 1.4;
  const artist = artistKey(track);
  const album = albumKey(track);
  const last = recent[recent.length - 1];

  if (last) {
    if (artist && artist === artistKey(last)) score -= 2.4;
    if (album && album === albumKey(last)) score -= 1.8;
  }

  for (let i = 0; i < recent.length; i++) {
    const weight = (i + 1) / recent.length;
    if (artist && artist === artistKey(recent[i])) score -= 0.55 * weight;
    if (album && album === albumKey(recent[i])) score -= 0.3 * weight;
  }

  if (artist) {
    const times = picked.filter((t) => artistKey(t) === artist).length;
    score -= times * 0.45;
  }

  return score;
}

function pickBestIndex(pool: PlayerTrack[], recent: PlayerTrack[], picked: PlayerTrack[]): number {
  let bestIdx = 0;
  let bestScore = -Infinity;
  for (let i = 0; i < pool.length; i++) {
    const score = scoreTrack(pool[i], recent, picked);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/** Build a play order by repeatedly picking the best-scoring remaining track. */
function smartShuffle(tracks: PlayerTrack[], history: PlayerTrack[] = []): PlayerTrack[] {
  if (tracks.length <= 1) return [...tracks];
  const pool = [...tracks];
  const result: PlayerTrack[] = [];
  let recent = [...history].slice(-6);

  while (pool.length > 0) {
    const idx = pickBestIndex(pool, recent, result);
    const [chosen] = pool.splice(idx, 1);
    result.push(chosen);
    recent = [...recent, chosen].slice(-6);
  }

  return result;
}

function toSessionTrack(track: PlayerTrack): PlayerTrack {
  return {
    id: track.id,
    title: track.title,
    album: track.album,
    albumId: track.albumId,
    artist: track.artist,
    artistId: track.artistId,
    coverArt: track.coverArt,
    track: track.track,
    duration: track.duration,
    year: track.year,
    size: track.size,
  };
}

interface PlayerContextValue {
  queue: PlayerTrack[];
  upcoming: PlayerTrack[];
  current: PlayerTrack | null;
  currentIndex: number;
  playing: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  queuePanelOpen: boolean;
  lyricsMode: LyricsMode;
  positionMs: number;
  durationMs: number;
  volume: number;
  /** Bumped on every user-driven volume change so the on-screen readout can flash. */
  volumeNudge: number;
  muted: boolean;
  source: PlaybackSource | null;
  sessionReady: boolean;
  lastPath: string;
  playTracks: (
    tracks: PlayerTrack[],
    startIndex?: number,
    opts?: { shuffle?: boolean; source?: PlaybackSource },
  ) => Promise<void>;
  playQueueIndex: (index: number) => void;
  removeFromQueue: (index: number) => void;
  removeCurrentFromQueue: () => void;
  toggle: () => void;
  play: () => void;
  pause: () => void;
  next: () => void;
  prev: () => void;
  seek: (ms: number) => void;
  seekBy: (deltaMs: number) => void;
  setVolume: (v: number) => void;
  adjustVolume: (steps: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  toggleQueuePanel: () => void;
  setQueuePanelOpen: (open: boolean) => void;
  cycleLyricsMode: () => void;
  setLyricsMode: (mode: LyricsMode) => void;
  setLastPath: (path: string) => void;
  sleepTimerEndsAt: number | null;
  setSleepTimer: (minutes: number | null) => void;
  autoDjEnabled: boolean;
  autoDjMode: AutoDjMode;
  autoDjCount: number;
  autoDjTrigger: number;
  setAutoDjEnabled: (enabled: boolean) => void;
  setAutoDjMode: (mode: AutoDjMode) => void;
  setAutoDjCount: (count: number) => void;
  setAutoDjTrigger: (count: number) => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const { auth } = useSettings();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const queueRef = useRef<PlayerTrack[]>([]);
  const currentIndexRef = useRef(-1);
  const queueLenRef = useRef(0);
  const shuffleRef = useRef(false);
  const repeatRef = useRef<RepeatMode>("off");
  const volumeRef = useRef(0.85);
  const preMuteVolumeRef = useRef(0.85);
  const positionRef = useRef(0);
  const playingRef = useRef(false);
  const sourceRef = useRef<PlaybackSource | null>(null);
  const queuePanelOpenRef = useRef(false);
  const lyricsModeRef = useRef<LyricsMode>("off");
  const lastPathRef = useRef("");
  const sessionReadyRef = useRef(false);
  const restoreSeekRef = useRef<number | null>(null);
  const restorePlayRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);
  const loadedTrackIdRef = useRef<string | null>(null);

  const [queue, setQueue] = useState<PlayerTrack[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>("off");
  const [queuePanelOpen, setQueuePanelOpenState] = useState(false);
  const [lyricsMode, setLyricsModeState] = useState<LyricsMode>("off");
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [volume, setVolumeState] = useState(0.85);
  const [volumeNudge, setVolumeNudge] = useState(0);
  const [source, setSourceState] = useState<PlaybackSource | null>(null);
  const [lastPath, setLastPathState] = useState("");
  const [sessionReady, setSessionReady] = useState(false);
  const [artworkUrl, setArtworkUrl] = useState<string | undefined>();
  const [sleepTimerEndsAt, setSleepTimerEndsAt] = useState<number | null>(null);
  const sleepTimerEndsAtRef = useRef<number | null>(null);
  const [autoDjEnabled, setAutoDjEnabledState] = useState(false);
  const [autoDjMode, setAutoDjModeState] = useState<AutoDjMode>("similar");
  const [autoDjCount, setAutoDjCountState] = useState(5);
  const [autoDjTrigger, setAutoDjTriggerState] = useState(2);
  const autoDjLoadingRef = useRef(false);
  sleepTimerEndsAtRef.current = sleepTimerEndsAt;

  const current = currentIndex >= 0 ? queue[currentIndex] ?? null : null;
  const upcoming = currentIndex >= 0 ? queue.slice(currentIndex + 1) : [];
  queueRef.current = queue;
  currentIndexRef.current = currentIndex;
  queueLenRef.current = queue.length;
  shuffleRef.current = shuffle;
  repeatRef.current = repeat;
  volumeRef.current = volume;
  positionRef.current = positionMs;
  playingRef.current = playing;
  sourceRef.current = source;
  queuePanelOpenRef.current = queuePanelOpen;
  lyricsModeRef.current = lyricsMode;
  lastPathRef.current = lastPath;
  sessionReadyRef.current = sessionReady;

  const buildPayload = useCallback((): PlaybackSessionPayload => {
    const idx = currentIndexRef.current;
    return {
      queue: queueRef.current.map(toSessionTrack),
      currentIndex: idx,
      positionMs: positionRef.current,
      volume: volumeRef.current,
      shuffle: shuffleRef.current,
      repeat: repeatRef.current,
      queuePanelOpen: queuePanelOpenRef.current,
      wasPlaying: playingRef.current,
      source: sourceRef.current,
      lastPath: lastPathRef.current,
    };
  }, []);

  const persistSession = useCallback(
    async (immediate = false) => {
      if (!sessionReadyRef.current) return;
      const write = async () => {
        try {
          await invoke("session_set", { payload: buildPayload() });
        } catch {
          /* ignore disk errors while playing */
        }
      };
      if (immediate) {
        if (saveTimerRef.current != null) {
          window.clearTimeout(saveTimerRef.current);
          saveTimerRef.current = null;
        }
        await write();
        return;
      }
      if (saveTimerRef.current != null) return;
      saveTimerRef.current = window.setTimeout(() => {
        saveTimerRef.current = null;
        void write();
      }, 800);
    },
    [buildPayload],
  );

  const advanceFrom = useCallback((idx: number) => {
    const q = queueRef.current;
    if (idx < 0 || q.length === 0) return;

    // Repeat one is handled on track end; Next always advances.

    if (shuffleRef.current) {
      const played = q.slice(0, idx + 1);
      const remaining = q.slice(idx + 1);

      if (remaining.length > 0) {
        const reordered = smartShuffle(remaining, played.slice(-6));
        setQueue([...played, ...reordered]);
        setCurrentIndex(idx + 1);
        return;
      }

      if (repeatRef.current === "all" && q.length > 1) {
        const currentTrack = q[idx];
        const others = smartShuffle(
          q.filter((_, i) => i !== idx),
          [currentTrack],
        );
        setQueue([currentTrack, ...others]);
        setCurrentIndex(1);
        return;
      }

      return;
    }

    if (idx < q.length - 1) {
      setCurrentIndex(idx + 1);
      return;
    }
    if (repeatRef.current === "all" && q.length > 0) {
      setCurrentIndex(0);
    }
  }, []);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = "metadata";
    audioRef.current = audio;

    const onTime = () => {
      const ms = (audio.currentTime || 0) * 1000;
      positionRef.current = ms;
      setPositionMs(ms);
    };
    const onMeta = () => setDurationMs((audio.duration || 0) * 1000);
    const onPlay = () => {
      playingRef.current = true;
      setPlaying(true);
      void persistSession(true);
    };
    const onPause = () => {
      playingRef.current = false;
      setPlaying(false);
      void persistSession(true);
    };
    const onEnded = () => {
      if (sleepTimerEndsAtRef.current != null && Date.now() >= sleepTimerEndsAtRef.current) {
        audio.pause();
        sleepTimerEndsAtRef.current = null;
        setSleepTimerEndsAt(null);
        return;
      }
      if (repeatRef.current === "one") {
        audio.currentTime = 0;
        void audio.play();
        return;
      }
      advanceFrom(currentIndexRef.current);
    };

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audioRef.current = null;
    };
  }, [advanceFrom, persistSession]);

  useEffect(() => {
    if (sleepTimerEndsAt == null) return;
    const remaining = Math.max(0, sleepTimerEndsAt - Date.now());
    const timer = window.setTimeout(() => {
      audioRef.current?.pause();
      sleepTimerEndsAtRef.current = null;
      setSleepTimerEndsAt(null);
    }, remaining);
    return () => window.clearTimeout(timer);
  }, [sleepTimerEndsAt]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  // Restore saved session once auth is ready.
  useEffect(() => {
    if (!auth || sessionReady) return;
    let cancelled = false;

    (async () => {
      try {
        const saved = await invoke<PlaybackSessionPayload>("session_get");
        if (cancelled) return;

        const nextVolume = snapVolume(saved.volume ?? 0.85);
        const nextRepeat: RepeatMode =
          saved.repeat === "all" || saved.repeat === "one" ? saved.repeat : "off";
        const nextPath = saved.lastPath ?? "";
        const nextSource = saved.source ?? null;
        const rawQueue = Array.isArray(saved.queue) ? saved.queue : [];

        setVolumeState(nextVolume);
        volumeRef.current = nextVolume;
        setShuffle(Boolean(saved.shuffle));
        shuffleRef.current = Boolean(saved.shuffle);
        setRepeat(nextRepeat);
        repeatRef.current = nextRepeat;
        setQueuePanelOpenState(Boolean(saved.queuePanelOpen));
        queuePanelOpenRef.current = Boolean(saved.queuePanelOpen);
        setLastPathState(nextPath);
        lastPathRef.current = nextPath;
        setSourceState(nextSource);
        sourceRef.current = nextSource;

        if (rawQueue.length > 0) {
          const refreshed = await Promise.all(
            rawQueue.map(async (t) => ({
              ...t,
              coverUrl: await coverArtUrl(auth, t.coverArt, 300),
            })),
          );
          if (cancelled) return;

          let idx = Number.isFinite(saved.currentIndex) ? Math.floor(saved.currentIndex) : 0;
          if (idx < 0) idx = 0;
          if (idx >= refreshed.length) idx = refreshed.length - 1;

          restoreSeekRef.current = Math.max(0, saved.positionMs || 0);
          restorePlayRef.current = Boolean(saved.wasPlaying);
          loadedTrackIdRef.current = null;
          setQueue(refreshed);
          setCurrentIndex(idx);
          setDurationMs((refreshed[idx]?.duration ?? 0) * 1000);
          setPositionMs(Math.max(0, saved.positionMs || 0));
          positionRef.current = Math.max(0, saved.positionMs || 0);
        }
      } catch {
        /* fresh install / missing session */
      } finally {
        if (!cancelled) {
          setSessionReady(true);
          sessionReadyRef.current = true;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [auth, sessionReady]);

  // Persist when queue / controls change.
  useEffect(() => {
    if (!sessionReady) return;
    void persistSession(true);
  }, [queue, currentIndex, shuffle, repeat, queuePanelOpen, source, lastPath, volume, sessionReady, persistSession]);

  // Periodic position checkpoint while playing.
  useEffect(() => {
    if (!sessionReady || !playing) return;
    const id = window.setInterval(() => {
      void persistSession(true);
    }, 4000);
    return () => window.clearInterval(id);
  }, [sessionReady, playing, persistSession]);

  // Flush on tab/app hide.
  useEffect(() => {
    const flush = () => {
      void persistSession(true);
    };
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", flush);
    return () => {
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", flush);
      flush();
    };
  }, [persistSession]);

  const loadAndPlay = useCallback(
    async (track: PlayerTrack) => {
      if (!auth || !audioRef.current) return;
      const url = await streamUrl(auth, track.id);
      const audio = audioRef.current;
      const seekTo = restoreSeekRef.current;
      const shouldPlay = restoreSeekRef.current != null ? restorePlayRef.current : true;
      restoreSeekRef.current = null;
      restorePlayRef.current = false;

      audio.src = url;
      setDurationMs((track.duration ?? 0) * 1000);

      const applySeek = () => {
        if (seekTo != null && seekTo > 0) {
          try {
            audio.currentTime = seekTo / 1000;
          } catch {
            /* ignore */
          }
          positionRef.current = seekTo;
          setPositionMs(seekTo);
        } else {
          positionRef.current = 0;
          setPositionMs(0);
        }
      };

      if (seekTo != null && seekTo > 0) {
        await new Promise<void>((resolve) => {
          const onReady = () => {
            audio.removeEventListener("loadedmetadata", onReady);
            applySeek();
            resolve();
          };
          audio.addEventListener("loadedmetadata", onReady);
          // Fallback if metadata already available.
          if (audio.readyState >= 1) onReady();
        });
      } else {
        applySeek();
      }

      if (shouldPlay) {
        try {
          await audio.play();
        } catch {
          /* autoplay may be blocked after restore */
        }
      } else {
        audio.pause();
      }
    },
    [auth],
  );

  const setSleepTimer = useCallback((minutes: number | null) => {
    const endsAt = minutes == null ? null : Date.now() + minutes * 60_000;
    sleepTimerEndsAtRef.current = endsAt;
    setSleepTimerEndsAt(endsAt);
  }, []);

  const appendAutoDj = useCallback(async () => {
    if (!auth || !autoDjEnabled || autoDjLoadingRef.current || queueRef.current.length === 0) return;
    if (queueRef.current.length - currentIndexRef.current - 1 > autoDjTrigger) return;
    const track = queueRef.current[currentIndexRef.current];
    if (!track) return;
    autoDjLoadingRef.current = true;
    try {
      let songs: Song[];
      if (autoDjMode === "similar" && track.id) {
        try {
          songs = await getSimilarSongs(auth, track.id, autoDjCount * 3);
        } catch {
          songs = await getRandomSongs(auth, autoDjCount * 3);
        }
      } else {
        songs = await getRandomSongs(auth, autoDjCount * 3);
      }
      const existing = new Set(queueRef.current.map((item) => item.id));
      const additions = await Promise.all(songs
        .filter((song) => !existing.has(song.id))
        .slice(0, autoDjCount)
        .map(async (song) => ({
          ...song,
          coverUrl: await coverArtUrl(auth, song.coverArt, 300),
        })));
      if (additions.length) setQueue((previous) => [...previous, ...additions]);
    } catch {
      // Auto DJ is deliberately silent when a server lacks recommendation support.
    } finally {
      autoDjLoadingRef.current = false;
    }
  }, [auth, autoDjEnabled, autoDjMode, autoDjCount, autoDjTrigger]);

  useEffect(() => {
    void appendAutoDj();
  }, [appendAutoDj, currentIndex, queue.length]);

  useEffect(() => {
    if (currentIndex < 0 || !queue[currentIndex]) return;
    const track = queue[currentIndex];
    if (loadedTrackIdRef.current === track.id) return;
    loadedTrackIdRef.current = track.id;
    void loadAndPlay(track);
  }, [currentIndex, queue, loadAndPlay]);

  const playTracks = useCallback(
    async (
      tracks: PlayerTrack[],
      startIndex = 0,
      opts?: { shuffle?: boolean; source?: PlaybackSource },
    ) => {
      if (!tracks.length) return;
      const explicitShuffle = opts?.shuffle === true;
      const shouldShuffle = explicitShuffle || shuffleRef.current;
      if (explicitShuffle) {
        shuffleRef.current = true;
        setShuffle(true);
      }

      let ordered = [...tracks];
      let index = Math.max(0, Math.min(startIndex, ordered.length - 1));

      if (shouldShuffle) {
        if (explicitShuffle) {
          ordered = smartShuffle(ordered);
          index = 0;
        } else {
          const selected = ordered[index];
          const rest = smartShuffle(
            ordered.filter((_, i) => i !== index),
            [selected],
          );
          ordered = [selected, ...rest];
          index = 0;
        }
      }

      if (opts?.source) {
        sourceRef.current = opts.source;
        setSourceState(opts.source);
      }

      restoreSeekRef.current = null;
      restorePlayRef.current = true;
      loadedTrackIdRef.current = null;
      setQueue(ordered);
      setCurrentIndex(index);
    },
    [],
  );

  const playQueueIndex = useCallback((index: number) => {
    setCurrentIndex((idx) => {
      if (index < 0 || index >= queueLenRef.current) return idx;
      return index;
    });
  }, []);

  const removeFromQueue = useCallback((index: number) => {
    const q = queueRef.current;
    if (index < 0 || index >= q.length) return;
    const nextQueue = q.filter((_, i) => i !== index);
    const current = currentIndexRef.current;
    let nextIndex = current;
    if (index < current) nextIndex = current - 1;
    else if (index === current) {
      nextIndex = Math.min(current, nextQueue.length - 1);
      loadedTrackIdRef.current = null;
    }
    setQueue(nextQueue);
    setCurrentIndex(nextIndex);
    if (nextQueue.length === 0) {
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.removeAttribute("src");
      }
      setPlaying(false);
      setPositionMs(0);
      setDurationMs(0);
    }
  }, []);

  const removeCurrentFromQueue = useCallback(() => {
    const idx = currentIndexRef.current;
    if (idx < 0) return;
    removeFromQueue(idx);
  }, [removeFromQueue]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !current) return;
    if (audio.paused) void audio.play();
    else audio.pause();
  }, [current]);

  const play = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !current) return;
    if (audio.paused) void audio.play();
  }, [current]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  const next = useCallback(() => {
    advanceFrom(currentIndexRef.current);
  }, [advanceFrom]);

  const prev = useCallback(() => {
    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    setCurrentIndex((idx) => (idx > 0 ? idx - 1 : idx));
  }, []);

  const seek = useCallback(
    (ms: number) => {
      const audio = audioRef.current;
      if (!audio) return;
      audio.currentTime = ms / 1000;
      positionRef.current = ms;
      setPositionMs(ms);
      void persistSession(true);
    },
    [persistSession],
  );

  const seekBy = useCallback(
    (deltaMs: number) => {
      const audio = audioRef.current;
      if (!audio || !current) return;
      const totalMs = (audio.duration || 0) * 1000;
      const target = Math.max(0, positionRef.current + deltaMs);
      seek(totalMs > 0 ? Math.min(totalMs, target) : target);
    },
    [current, seek],
  );

  const setVolume = useCallback(
    (v: number) => {
      const next = snapVolume(v);
      volumeRef.current = next;
      setVolumeState(next);
      setVolumeNudge((n) => n + 1);
      void persistSession();
    },
    [persistSession],
  );

  const adjustVolume = useCallback(
    (steps: number) => {
      setVolume(volumeRef.current + steps * VOLUME_STEP);
    },
    [setVolume],
  );

  const toggleMute = useCallback(() => {
    if (volumeRef.current > 0) {
      preMuteVolumeRef.current = volumeRef.current;
      setVolume(0);
      return;
    }
    setVolume(preMuteVolumeRef.current || 0.5);
  }, [setVolume]);

  const toggleShuffle = useCallback(() => {
    setShuffle((on) => {
      const nextOn = !on;
      shuffleRef.current = nextOn;
      if (nextOn) {
        const idx = currentIndexRef.current;
        const q = queueRef.current;
        if (idx >= 0 && q.length > 1) {
          const currentTrack = q[idx];
          const rest = smartShuffle(
            q.filter((_, i) => i !== idx),
            [currentTrack],
          );
          setQueue([currentTrack, ...rest]);
          setCurrentIndex(0);
        }
      }
      return nextOn;
    });
  }, []);

  const toggleQueuePanel = useCallback(() => {
    setQueuePanelOpenState((open) => {
      const next = !open;
      queuePanelOpenRef.current = next;
      if (next && lyricsModeRef.current === "side") {
        lyricsModeRef.current = "off";
        setLyricsModeState("off");
      }
      return next;
    });
  }, []);

  const setQueuePanelOpen = useCallback((open: boolean) => {
    queuePanelOpenRef.current = open;
    setQueuePanelOpenState(open);
    if (open && lyricsModeRef.current === "side") {
      lyricsModeRef.current = "off";
      setLyricsModeState("off");
    }
  }, []);

  const setLyricsMode = useCallback((mode: LyricsMode) => {
    lyricsModeRef.current = mode;
    setLyricsModeState(mode);
    if (mode === "side") {
      queuePanelOpenRef.current = false;
      setQueuePanelOpenState(false);
    }
  }, []);

  /** off → side panel → fullscreen → off */
  const cycleLyricsMode = useCallback(() => {
    setLyricsModeState((mode) => {
      const next: LyricsMode = mode === "off" ? "side" : mode === "side" ? "full" : "off";
      lyricsModeRef.current = next;
      if (next === "side") {
        queuePanelOpenRef.current = false;
        setQueuePanelOpenState(false);
      }
      return next;
    });
  }, []);

  const cycleRepeat = useCallback(() => {
    setRepeat((mode) => {
      const nextMode: RepeatMode = mode === "off" ? "all" : mode === "all" ? "one" : "off";
      repeatRef.current = nextMode;
      return nextMode;
    });
  }, []);

  const setLastPath = useCallback((path: string) => {
    if (!path || path === lastPathRef.current) return;
    lastPathRef.current = path;
    setLastPathState(path);
  }, []);

  const setAutoDjEnabled = useCallback((enabled: boolean) => setAutoDjEnabledState(enabled), []);
  const setAutoDjMode = useCallback((mode: AutoDjMode) => setAutoDjModeState(mode), []);
  const setAutoDjCount = useCallback((count: number) => setAutoDjCountState(Math.max(1, Math.min(20, count))), []);
  const setAutoDjTrigger = useCallback((count: number) => setAutoDjTriggerState(Math.max(1, Math.min(5, count))), []);

  // Larger art than the player bar uses, for the Windows media flyout.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!auth || !current?.coverArt) {
        setArtworkUrl(undefined);
        return;
      }
      const url = await coverArtUrl(auth, current.coverArt, 600);
      if (!cancelled) setArtworkUrl(url);
    })();
    return () => {
      cancelled = true;
    };
  }, [auth, current?.coverArt]);

  useMediaSession({
    track: current,
    artworkUrl,
    playing,
    positionMs,
    durationMs,
    play,
    pause,
    next,
    prev,
    seek,
    seekBy,
  });

  const value = useMemo(
    () => ({
      queue,
      upcoming,
      current,
      currentIndex,
      playing,
      shuffle,
      repeat,
      queuePanelOpen,
      lyricsMode,
      positionMs,
      durationMs,
      volume,
      volumeNudge,
      muted: volume === 0,
      source,
      sessionReady,
      lastPath,
      playTracks,
      playQueueIndex,
      removeFromQueue,
      removeCurrentFromQueue,
      toggle,
      play,
      pause,
      next,
      prev,
      seek,
      seekBy,
      setVolume,
      adjustVolume,
      toggleMute,
      toggleShuffle,
      cycleRepeat,
      toggleQueuePanel,
      setQueuePanelOpen,
      cycleLyricsMode,
      setLyricsMode,
      setLastPath,
      sleepTimerEndsAt,
      setSleepTimer,
      autoDjEnabled,
      autoDjMode,
      autoDjCount,
      autoDjTrigger,
      setAutoDjEnabled,
      setAutoDjMode,
      setAutoDjCount,
      setAutoDjTrigger,
    }),
    [
      queue,
      upcoming,
      current,
      currentIndex,
      playing,
      shuffle,
      repeat,
      queuePanelOpen,
      lyricsMode,
      positionMs,
      durationMs,
      volume,
      volumeNudge,
      source,
      sessionReady,
      lastPath,
      playTracks,
      playQueueIndex,
      removeFromQueue,
      removeCurrentFromQueue,
      toggle,
      play,
      pause,
      next,
      prev,
      seek,
      seekBy,
      setVolume,
      adjustVolume,
      toggleMute,
      toggleShuffle,
      cycleRepeat,
      toggleQueuePanel,
      setQueuePanelOpen,
      cycleLyricsMode,
      setLyricsMode,
      setLastPath,
      sleepTimerEndsAt,
      setSleepTimer,
      autoDjEnabled,
      autoDjMode,
      autoDjCount,
      autoDjTrigger,
      setAutoDjEnabled,
      setAutoDjMode,
      setAutoDjCount,
      setAutoDjTrigger,
    ],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within PlayerProvider");
  return ctx;
}
