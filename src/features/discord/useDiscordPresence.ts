/**
 * Discord Rich Presence bridge.
 * Pattern aligned with AMWin-RP (not a copy):
 * - Listening activity
 * - details = title, state = artist, large_text = album
 * - Large image = public HTTPS cover URL when Discord can fetch it, else portal asset
 * - Timestamps only while playing (start/end from position); clear on pause
 * - Refresh about every 5s so seek stays accurate
 */
import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { usePlayer } from "../player/PlayerContext";
import { useSettings } from "../settings/SettingsContext";

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
  // Discord rejects some fields under 2 characters; AMWin-RP pads with NUL.
  if (value.length >= 2) return value;
  return `${value}\0`;
}

export function useDiscordPresence() {
  const { settings } = useSettings();
  const { current, playing, positionMs, durationMs } = usePlayer();
  const positionRef = useRef(positionMs);
  const durationRef = useRef(durationMs);
  positionRef.current = positionMs;
  durationRef.current = durationMs;

  useEffect(() => {
    if (!settings.discordShowListening || !settings.discordClientId) {
      void invoke("discord_clear_presence").catch(() => undefined);
      return;
    }

    if (!current) {
      void invoke("discord_clear_presence").catch(() => undefined);
      return;
    }

    // Match AMWin-RP: when paused, clear presence (unless you later add a "show when paused" setting).
    if (!playing) {
      void invoke("discord_clear_presence").catch(() => undefined);
      return;
    }

    const send = () => {
      const payload: PresencePayload = {
        title: padDiscordText(current.title || "?"),
        artist: padDiscordText(current.artist || "Unknown Artist"),
        album: current.album || "Unknown Album",
        positionMs: Math.floor(positionRef.current),
        durationMs: Math.floor(durationRef.current || (current.duration ?? 0) * 1000),
        coverUrl: current.coverUrl ?? null,
        serverUrl: settings.serverUrl,
        clientId: settings.discordClientId,
        fallbackImageKey: settings.discordFallbackImageKey || "app_logo",
        paused: false,
      };
      void invoke("discord_set_presence", { payload }).catch(() => undefined);
    };

    send();
    const timer = window.setInterval(send, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [
    settings.discordShowListening,
    settings.discordClientId,
    settings.discordFallbackImageKey,
    settings.serverUrl,
    current,
    playing,
  ]);
}
