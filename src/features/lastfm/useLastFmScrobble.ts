import { useEffect, useRef } from "react";
import {
  scrobbleThresholdMs,
  scrobbleTrack,
  updateNowPlaying,
} from "../../lib/lastfm";
import { usePlayer } from "../player/PlayerContext";
import { useSettings } from "../settings/SettingsContext";

interface TrackState {
  id: string;
  sentNowPlaying: boolean;
  scrobbled: boolean;
  startTimestamp: number;
}

export function useLastFmScrobble() {
  const { settings } = useSettings();
  const { current, playing, positionMs, durationMs } = usePlayer();
  const stateRef = useRef<TrackState | null>(null);

  useEffect(() => {
    const enabled = settings.lastFmScrobbleEnabled;
    const apiKey = settings.lastFmApiKey.trim();
    const apiSecret = settings.lastFmApiSecret.trim();
    const sessionKey = settings.lastFmSessionKey.trim();

    if (!enabled || !apiKey || !apiSecret || !sessionKey) {
      stateRef.current = null;
      return;
    }

    if (!current) {
      stateRef.current = null;
      return;
    }

    if (stateRef.current?.id !== current.id) {
      stateRef.current = {
        id: current.id,
        sentNowPlaying: false,
        scrobbled: false,
        startTimestamp: Math.floor(Date.now() / 1000),
      };
    }

    const state = stateRef.current;
    if (!state) return;

    const artist = current.artist?.trim() || "Unknown Artist";
    const title = current.title?.trim() || "Unknown Title";
    const album = current.album?.trim();
    const durationSec = current.duration ?? Math.round(durationMs / 1000);

    const sendNowPlaying = async () => {
      if (state.sentNowPlaying || !playing) return;
      try {
        await updateNowPlaying(apiKey, apiSecret, sessionKey, {
          artist,
          title,
          album,
          durationSec,
        });
        state.sentNowPlaying = true;
      } catch (err) {
        console.warn("[lastfm] now playing failed", err);
      }
    };

    const tryScrobble = async () => {
      if (state.scrobbled) return;
      const threshold = scrobbleThresholdMs(durationMs || (durationSec ?? 0) * 1000);
      if (positionMs < threshold) return;
      try {
        await scrobbleTrack(apiKey, apiSecret, sessionKey, {
          artist,
          title,
          album,
          durationSec,
          timestamp: state.startTimestamp,
        });
        state.scrobbled = true;
      } catch (err) {
        console.warn("[lastfm] scrobble failed", err);
      }
    };

    if (playing) {
      void sendNowPlaying();
      void tryScrobble();
    }
  }, [
    settings.lastFmScrobbleEnabled,
    settings.lastFmApiKey,
    settings.lastFmApiSecret,
    settings.lastFmSessionKey,
    current,
    playing,
    positionMs,
    durationMs,
  ]);

  // Scrobble on track end if threshold was met
  useEffect(() => {
    if (!current || !playing) return;
    const trackId = current.id;
    return () => {
      const state = stateRef.current;
      if (!state || state.id !== trackId || state.scrobbled) return;

      const apiKey = settings.lastFmApiKey.trim();
      const apiSecret = settings.lastFmApiSecret.trim();
      const sessionKey = settings.lastFmSessionKey.trim();
      if (!settings.lastFmScrobbleEnabled || !apiKey || !apiSecret || !sessionKey) return;

      const threshold = scrobbleThresholdMs(
        durationMs || (current.duration ?? 0) * 1000,
      );
      if (positionMs < threshold) return;

      void scrobbleTrack(apiKey, apiSecret, sessionKey, {
        artist: current.artist?.trim() || "Unknown Artist",
        title: current.title?.trim() || "Unknown Title",
        album: current.album?.trim(),
        durationSec: current.duration,
        timestamp: state.startTimestamp,
      }).catch((err) => console.warn("[lastfm] scrobble on end failed", err));
    };
  }, [
    current?.id,
    playing,
    positionMs,
    durationMs,
    settings.lastFmScrobbleEnabled,
    settings.lastFmApiKey,
    settings.lastFmApiSecret,
    settings.lastFmSessionKey,
    current,
  ]);
}
