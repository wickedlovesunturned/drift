import type { AuthConfig } from "./subsonic/client";
import { getLyrics as getServerLyrics } from "./subsonic/client";
import { isLrcFormat, parseLrc, type LrcLine } from "./lrc";

export type LyricsSource = "server" | "lrclib";

export interface TrackLyrics {
  synced: LrcLine[] | null;
  plain: string[] | null;
  source: LyricsSource;
}

const cache = new Map<string, TrackLyrics | null>();

function cacheKey(artist: string, title: string, album: string): string {
  return `${artist}::${title}::${album}`.toLowerCase();
}

async function fetchLrcLib(
  artist: string,
  title: string,
  album: string,
  durationSec?: number,
): Promise<TrackLyrics | null> {
  const params = new URLSearchParams({
    artist_name: artist.trim(),
    track_name: title.trim(),
  });
  if (album.trim()) params.set("album_name", album.trim());
  if (durationSec) params.set("duration", String(Math.round(durationSec)));

  const res = await fetch(`https://lrclib.net/api/get?${params.toString()}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`LRCLIB HTTP ${res.status}`);

  const json = (await res.json()) as {
    syncedLyrics?: string | null;
    plainLyrics?: string | null;
  };

  const syncedRaw = json.syncedLyrics?.trim();
  const plainRaw = json.plainLyrics?.trim();

  if (syncedRaw && isLrcFormat(syncedRaw)) {
    return {
      synced: parseLrc(syncedRaw),
      plain: plainRaw ? plainRaw.split(/\r?\n/).filter(Boolean) : null,
      source: "lrclib",
    };
  }
  if (plainRaw) {
    return {
      synced: null,
      plain: plainRaw.split(/\r?\n/).filter(Boolean),
      source: "lrclib",
    };
  }
  return null;
}

export async function fetchTrackLyrics(
  auth: AuthConfig | null,
  artist: string,
  title: string,
  album: string,
  durationSec?: number,
): Promise<TrackLyrics | null> {
  const key = cacheKey(artist, title, album);
  if (cache.has(key)) return cache.get(key) ?? null;

  try {
    if (auth) {
      const server = await getServerLyrics(auth, artist, title);
      const text = server?.value?.trim();
      if (text) {
        if (isLrcFormat(text)) {
          const result: TrackLyrics = {
            synced: parseLrc(text),
            plain: null,
            source: "server",
          };
          cache.set(key, result);
          return result;
        }
        const result: TrackLyrics = {
          synced: null,
          plain: text.split(/\r?\n/).filter(Boolean),
          source: "server",
        };
        cache.set(key, result);
        return result;
      }
    }

    const remote = await fetchLrcLib(artist, title, album, durationSec);
    cache.set(key, remote);
    return remote;
  } catch (err) {
    console.warn("[lyrics] fetch failed", err);
    cache.set(key, null);
    return null;
  }
}

export function lyricsOffsetKey(trackId: string): string {
  return `drift.lyricsOffset.${trackId}`;
}

export function loadLyricsOffset(trackId: string): number {
  try {
    const raw = localStorage.getItem(lyricsOffsetKey(trackId));
    return raw ? Number(raw) : 0;
  } catch {
    return 0;
  }
}

export function saveLyricsOffset(trackId: string, offsetMs: number): void {
  try {
    localStorage.setItem(lyricsOffsetKey(trackId), String(offsetMs));
  } catch {
    /* ignore */
  }
}
