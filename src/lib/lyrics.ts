import type { AuthConfig } from "./subsonic/client";
import { getLyrics as getServerLyrics, getLyricsBySongId } from "./subsonic/client";
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

  let res = await fetch(`https://lrclib.net/api/get?${params.toString()}`);
  if (res.status === 404) {
    const searchParams = new URLSearchParams({
      track_name: title.trim(),
      artist_name: artist.trim(),
      ...(album.trim() ? { album_name: album.trim() } : {}),
    });
    const search = await fetch(`https://lrclib.net/api/search?${searchParams.toString()}`);
    if (!search.ok) return null;
    const matches = (await search.json()) as {
      syncedLyrics?: string | null;
      plainLyrics?: string | null;
      trackName?: string;
      artistName?: string;
      albumName?: string;
      duration?: number;
    }[];
    const clean = (value: string | undefined) => (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "").trim();
    const wantedArtist = clean(artist);
    const wantedTitle = clean(title);
    const wantedAlbum = clean(album);
    const wantedDuration = durationSec ?? 0;
    const scored = matches
      .filter((item) => item.syncedLyrics?.trim())
      .map((item) => {
        let score = 0;
        if (clean(item.artistName) === wantedArtist) score += 5;
        if (clean(item.trackName) === wantedTitle) score += 5;
        if (wantedAlbum && clean(item.albumName) === wantedAlbum) score += 3;
        if (wantedDuration && item.duration) score += Math.max(0, 3 - Math.abs(item.duration - wantedDuration));
        return { item, score };
      })
      .sort((a, b) => b.score - a.score);
    const match = scored[0]?.item ?? matches[0];
    if (!match) return null;
    res = new Response(JSON.stringify(match), { status: 200, headers: { "Content-Type": "application/json" } });
  }
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
  trackId?: string,
): Promise<TrackLyrics | null> {
  const key = cacheKey(artist, title, album);
  if (cache.has(key)) return cache.get(key) ?? null;

  try {
    let serverPlain: TrackLyrics | null = null;
    if (auth) {
      try {
        const structured = trackId ? await getLyricsBySongId(auth, trackId, true) : null;
        const lines = structured?.line?.filter((line) => typeof line.start === "number" && line.value?.trim());
        if (structured && lines?.length) {
          const cueLines = structured.cueLine ?? [];
          const result: TrackLyrics = {
            synced: lines.map((line, index) => {
              const cueLine = cueLines.find((entry) => entry.index === index) ?? cueLines[index];
              const offset = structured.offset ?? 0;
              return {
                timeMs: (line.start ?? 0) + offset,
                text: line.value?.trim() ?? "",
                cues: cueLine?.cue?.flatMap((cue) => {
                  if (typeof cue.start !== "number" || !cue.value?.trim()) return [];
                  return [{
                    timeMs: cue.start + offset,
                    endMs: typeof cue.end === "number" ? cue.end + offset : undefined,
                    text: cue.value,
                  }];
                }),
              };
            }),
            plain: null,
            source: "server",
          };
          cache.set(key, result);
          return result;
        }
      } catch {
        // Older Subsonic servers do not implement the OpenSubsonic endpoint.
      }
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
        serverPlain = {
          synced: null,
          plain: text.split(/\r?\n/).filter(Boolean),
          source: "server",
        };
      }
    }

    const remote = await fetchLrcLib(artist, title, album, durationSec);
    const result = remote?.synced?.length ? remote : serverPlain ?? remote;
    cache.set(key, result);
    return result;
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
