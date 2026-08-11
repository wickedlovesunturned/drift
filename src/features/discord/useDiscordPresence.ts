/**
 * Discord Rich Presence bridge (AMWin-RP patterns, not a copy):
 * Listening activity, details=title, state=artist, large_text=album,
 * Last.fm HTTPS cover as LargeImageKey when available, else portal asset,
 * millisecond timestamps while playing, ~5s refresh, clear on pause.
 */
import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { usePlayer } from "../player/PlayerContext";
import { useSettings } from "../settings/SettingsContext";
import { fetchLastFmAlbumArt } from "../../lib/lastfm";

const REFRESH_MS = 5000;

interface PresencePayload {
  title: string;
  artist: string;
  album: string;
  positionMs: number;
  durationMs: number;
  coverUrl?: string | null;
  serverUrl: string;
  clientId: string;
  fallbackImageKey: string;
  paused: boolean;
}

function padDiscordText(value: string): string {
  if (value.length >= 2) return value;
  return `${value}\0`;
}

export function useDiscordPresence() {
  const { settings } = useSettings();
  const { current, playing, positionMs, durationMs } = usePlayer();
  const positionRef = useRef(positionMs);
  const durationRef = useRef(durationMs);
  const coverCacheRef = useRef<{ trackKey: string; url: string | null }>({
    trackKey: "",
    url: null,
  });
  const [lastError, setLastError] = useState<string | null>(null);
  positionRef.current = positionMs;
  durationRef.current = durationMs;

  useEffect(() => {
    if (!settings.discordShowListening || !settings.discordClientId.trim()) {
      void invoke("discord_clear_presence").catch(() => undefined);
      return;
    }

    if (!current || !playing) {
      void invoke("discord_clear_presence").catch(() => undefined);
      return;
    }

    const trackKey = `${current.id}:${current.artist}:${current.album}`;

    const resolveCover = async (): Promise<string | null> => {
      if (coverCacheRef.current.trackKey === trackKey) {
        return coverCacheRef.current.url;
      }
      let url: string | null = null;
      if (settings.lastFmApiKey.trim()) {
        url = await fetchLastFmAlbumArt(
          settings.lastFmApiKey,
          current.artist || "",
          current.album || "",
        );
      }
      // Only use Navidrome covers if they are already public HTTPS (rare for self-host).
      if (!url && current.coverUrl?.startsWith("https://")) {
        url = current.coverUrl;
      }
      coverCacheRef.current = { trackKey, url };
      return url;
    };

    const send = async () => {
      const coverUrl = await resolveCover();
      const payload: PresencePayload = {
        title: padDiscordText(current.title || "?"),
        artist: padDiscordText(current.artist || "Unknown Artist"),
        album: padDiscordText(current.album || "Unknown Album"),
        positionMs: Math.floor(positionRef.current),
        durationMs: Math.floor(durationRef.current || (current.duration ?? 0) * 1000),
        coverUrl,
        serverUrl: settings.serverUrl,
        clientId: settings.discordClientId.trim(),
        fallbackImageKey: settings.discordFallbackImageKey || "app_logo",
        paused: false,
      };
      try {
        await invoke("discord_set_presence", { payload });
        setLastError(null);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[discord]", msg);
        setLastError(msg);
      }
    };

    void send();
    const timer = window.setInterval(() => void send(), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [
    settings.discordShowListening,
    settings.discordClientId,
    settings.discordFallbackImageKey,
    settings.lastFmApiKey,
    settings.serverUrl,
    current,
    playing,
  ]);

  return { lastError };
}
