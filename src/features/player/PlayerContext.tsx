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
import type { Song } from "../../lib/subsonic/client";
import { streamUrl } from "../../lib/subsonic/client";
import { useSettings } from "../settings/SettingsContext";

export interface PlayerTrack extends Song {
  coverUrl?: string;
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

export type RepeatMode = "off" | "all" | "one";

interface PlayerContextValue {
  queue: PlayerTrack[];
  upcoming: PlayerTrack[];
  current: PlayerTrack | null;
  currentIndex: number;
  playing: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  queuePanelOpen: boolean;
  positionMs: number;
  durationMs: number;
  volume: number;
  playTracks: (tracks: PlayerTrack[], startIndex?: number, opts?: { shuffle?: boolean }) => Promise<void>;
  playQueueIndex: (index: number) => void;
  toggle: () => void;
  pause: () => void;
  next: () => void;
  prev: () => void;
  seek: (ms: number) => void;
  setVolume: (v: number) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  toggleQueuePanel: () => void;
  setQueuePanelOpen: (open: boolean) => void;
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
  const [queue, setQueue] = useState<PlayerTrack[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>("off");
  const [queuePanelOpen, setQueuePanelOpen] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [volume, setVolumeState] = useState(0.85);

  const current = currentIndex >= 0 ? queue[currentIndex] ?? null : null;
  const upcoming = currentIndex >= 0 ? queue.slice(currentIndex + 1) : [];
  queueRef.current = queue;
  currentIndexRef.current = currentIndex;
  queueLenRef.current = queue.length;
  shuffleRef.current = shuffle;
  repeatRef.current = repeat;

  const advanceFrom = useCallback((idx: number) => {
    const q = queueRef.current;
    if (idx < 0 || q.length === 0) return;

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

    const onTime = () => setPositionMs((audio.currentTime || 0) * 1000);
    const onMeta = () => setDurationMs((audio.duration || 0) * 1000);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => {
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
    audio.volume = volume;

    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audioRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advanceFrom]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  const loadAndPlay = useCallback(
    async (track: PlayerTrack) => {
      if (!auth || !audioRef.current) return;
      const url = await streamUrl(auth, track.id);
      const audio = audioRef.current;
      audio.src = url;
      setPositionMs(0);
      setDurationMs((track.duration ?? 0) * 1000);
      await audio.play();
    },
    [auth],
  );

  const loadedTrackIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (currentIndex < 0 || !queue[currentIndex]) return;
    const track = queue[currentIndex];
    if (loadedTrackIdRef.current === track.id) return;
    loadedTrackIdRef.current = track.id;
    void loadAndPlay(track);
  }, [currentIndex, queue, loadAndPlay]);

  const playTracks = useCallback(
    async (tracks: PlayerTrack[], startIndex = 0, opts?: { shuffle?: boolean }) => {
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
          // Shuffle button: algorithm picks the opener, then orders the rest.
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

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !current) return;
    if (audio.paused) void audio.play();
    else audio.pause();
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

  const seek = useCallback((ms: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = ms / 1000;
    setPositionMs(ms);
  }, []);

  const setVolume = useCallback((v: number) => {
    setVolumeState(Math.min(1, Math.max(0, v)));
  }, []);

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
    setQueuePanelOpen((open) => !open);
  }, []);

  const cycleRepeat = useCallback(() => {
    setRepeat((mode) => {
      const nextMode: RepeatMode = mode === "off" ? "all" : mode === "all" ? "one" : "off";
      repeatRef.current = nextMode;
      return nextMode;
    });
  }, []);

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
      positionMs,
      durationMs,
      volume,
      playTracks,
      playQueueIndex,
      toggle,
      pause,
      next,
      prev,
      seek,
      setVolume,
      toggleShuffle,
      cycleRepeat,
      toggleQueuePanel,
      setQueuePanelOpen,
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
      positionMs,
      durationMs,
      volume,
      playTracks,
      playQueueIndex,
      toggle,
      pause,
      next,
      prev,
      seek,
      setVolume,
      toggleShuffle,
      cycleRepeat,
      toggleQueuePanel,
    ],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within PlayerProvider");
  return ctx;
}
