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

function shuffleArray<T>(items: T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

interface PlayerContextValue {
  queue: PlayerTrack[];
  upcoming: PlayerTrack[];
  current: PlayerTrack | null;
  currentIndex: number;
  playing: boolean;
  shuffle: boolean;
  queuePanelOpen: boolean;
  positionMs: number;
  durationMs: number;
  volume: number;
  playTracks: (tracks: PlayerTrack[], startIndex?: number) => Promise<void>;
  playQueueIndex: (index: number) => void;
  toggle: () => void;
  pause: () => void;
  next: () => void;
  prev: () => void;
  seek: (ms: number) => void;
  setVolume: (v: number) => void;
  toggleShuffle: () => void;
  toggleQueuePanel: () => void;
  setQueuePanelOpen: (open: boolean) => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const { auth } = useSettings();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const queueLenRef = useRef(0);
  const shuffleRef = useRef(false);
  const [queue, setQueue] = useState<PlayerTrack[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [queuePanelOpen, setQueuePanelOpen] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [volume, setVolumeState] = useState(0.85);

  const current = currentIndex >= 0 ? queue[currentIndex] ?? null : null;
  const upcoming = currentIndex >= 0 ? queue.slice(currentIndex + 1) : [];
  queueLenRef.current = queue.length;
  shuffleRef.current = shuffle;

  useEffect(() => {
    const audio = new Audio();
    audio.preload = "metadata";
    audioRef.current = audio;

    const onTime = () => setPositionMs((audio.currentTime || 0) * 1000);
    const onMeta = () => setDurationMs((audio.duration || 0) * 1000);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => {
      setCurrentIndex((idx) => {
        if (idx < 0) return idx;
        if (idx < queueLenRef.current - 1) return idx + 1;
        return idx;
      });
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
  }, []);

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

  const playTracks = useCallback(async (tracks: PlayerTrack[], startIndex = 0) => {
    if (!tracks.length) return;
    let ordered = [...tracks];
    let index = Math.max(0, Math.min(startIndex, ordered.length - 1));
    if (shuffleRef.current) {
      const selected = ordered[index];
      const rest = shuffleArray(ordered.filter((_, i) => i !== index));
      ordered = [selected, ...rest];
      index = 0;
    }
    setQueue(ordered);
    setCurrentIndex(index);
  }, []);

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
    setCurrentIndex((idx) => (idx < queue.length - 1 ? idx + 1 : idx));
  }, [queue.length]);

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
        setQueue((q) => {
          if (currentIndex < 0 || q.length < 2) return q;
          const currentTrack = q[currentIndex];
          const rest = shuffleArray(q.filter((_, i) => i !== currentIndex));
          return [currentTrack, ...rest];
        });
        setCurrentIndex(0);
      }
      return nextOn;
    });
  }, [currentIndex]);

  const toggleQueuePanel = useCallback(() => {
    setQueuePanelOpen((open) => !open);
  }, []);

  const value = useMemo(
    () => ({
      queue,
      upcoming,
      current,
      currentIndex,
      playing,
      shuffle,
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
