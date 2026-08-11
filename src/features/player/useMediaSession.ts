import { useEffect } from "react";
import type { PlayerTrack } from "./PlayerContext";

interface MediaSessionOptions {
  track: PlayerTrack | null;
  artworkUrl?: string;
  playing: boolean;
  positionMs: number;
  durationMs: number;
  play: () => void;
  pause: () => void;
  next: () => void;
  prev: () => void;
  seek: (ms: number) => void;
  seekBy: (deltaMs: number) => void;
}

/**
 * Feeds the Windows System Media Transport Controls (the volume/media flyout and
 * hardware media keys) through the WebView's Media Session API.
 */
export function useMediaSession({
  track,
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
}: MediaSessionOptions) {
  const session = typeof navigator !== "undefined" ? navigator.mediaSession : undefined;

  useEffect(() => {
    if (!session) return;
    if (!track) {
      session.metadata = null;
      return;
    }

    session.metadata = new MediaMetadata({
      title: track.title || "Unknown title",
      artist: track.artist || "Unknown artist",
      album: track.album || "",
      artwork: artworkUrl
        ? [
            { src: artworkUrl, sizes: "96x96", type: "image/jpeg" },
            { src: artworkUrl, sizes: "256x256", type: "image/jpeg" },
            { src: artworkUrl, sizes: "512x512", type: "image/jpeg" },
          ]
        : [],
    });
  }, [session, track, artworkUrl]);

  useEffect(() => {
    if (!session) return;
    session.playbackState = playing ? "playing" : "paused";
  }, [session, playing]);

  useEffect(() => {
    if (!session?.setPositionState) return;
    const duration = durationMs / 1000;
    if (!Number.isFinite(duration) || duration <= 0) return;
    try {
      session.setPositionState({
        duration,
        playbackRate: 1,
        position: Math.min(Math.max(positionMs / 1000, 0), duration),
      });
    } catch {
      /* position outside the current duration during a track switch */
    }
  }, [session, positionMs, durationMs]);

  useEffect(() => {
    if (!session) return;
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ["play", () => play()],
      ["pause", () => pause()],
      ["stop", () => pause()],
      ["previoustrack", () => prev()],
      ["nexttrack", () => next()],
      ["seekbackward", (details) => seekBy(-(details.seekOffset ?? 10) * 1000)],
      ["seekforward", (details) => seekBy((details.seekOffset ?? 10) * 1000)],
      [
        "seekto",
        (details) => {
          if (details.seekTime != null) seek(details.seekTime * 1000);
        },
      ],
    ];

    for (const [action, handler] of handlers) {
      try {
        session.setActionHandler(action, handler);
      } catch {
        /* action unsupported by this WebView */
      }
    }

    return () => {
      for (const [action] of handlers) {
        try {
          session.setActionHandler(action, null);
        } catch {
          /* ignore */
        }
      }
    };
  }, [session, play, pause, next, prev, seek, seekBy]);
}
