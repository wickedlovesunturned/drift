/** Last.fm API client: album art, authentication, and scrobbling. */

import { md5Hex } from "./subsonic/client";

const API_BASE = "https://ws.audioscrobbler.com/2.0/";

const artCache = new Map<string, string | null>();

function cleanAlbumName(album: string): string {
  return album
    .replace(/\s*[([].*(deluxe|remaster|anniversary|expanded|edition|explicit).*[)\]]/gi, "")
    .replace(/\s*-\s*(deluxe|remastered?|anniversary).*$/gi, "")
    .trim();
}

function cacheKey(artist: string, album: string): string {
  return `${artist.toLowerCase().trim()}::${cleanAlbumName(album).toLowerCase()}`;
}

async function md5HexLocal(input: string): Promise<string> {
  return md5Hex(input);
}

function buildSignature(params: Record<string, string>, secret: string): string {
  const sorted = Object.keys(params)
    .filter((k) => k !== "format" && k !== "callback")
    .sort()
    .map((k) => `${k}${params[k]}`)
    .join("");
  return sorted + secret;
}

async function signedParams(
  params: Record<string, string>,
  secret: string,
): Promise<URLSearchParams> {
  const sig = await md5HexLocal(buildSignature(params, secret));
  const search = new URLSearchParams({ ...params, api_sig: sig, format: "json" });
  return search;
}

async function apiCall<T>(
  params: Record<string, string>,
  secret: string,
): Promise<T> {
  const body = await signedParams(params, secret);
  const res = await fetch(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`Last.fm HTTP ${res.status}`);
  const json = (await res.json()) as T & { error?: number; message?: string };
  if (json.error) {
    throw new Error(json.message || `Last.fm error ${json.error}`);
  }
  return json;
}

/** Returns a public HTTPS image URL Discord can fetch, or null. */
export async function fetchLastFmAlbumArt(
  apiKey: string,
  artist: string,
  album: string,
): Promise<string | null> {
  const key = apiKey.trim();
  if (!key || !artist.trim() || !album.trim()) return null;

  const ck = cacheKey(artist, album);
  if (artCache.has(ck)) return artCache.get(ck) ?? null;

  try {
    const params = new URLSearchParams({
      method: "album.getinfo",
      api_key: key,
      artist: artist.trim(),
      album: cleanAlbumName(album),
      format: "json",
    });
    const res = await fetch(`${API_BASE}?${params.toString()}`);
    if (!res.ok) {
      artCache.set(ck, null);
      return null;
    }
    const json = (await res.json()) as {
      album?: { image?: { size?: string; ["#text"]?: string }[] };
      error?: number;
    };
    if (json.error || !json.album?.image) {
      artCache.set(ck, null);
      return null;
    }

    const preferred = ["mega", "extralarge", "large"];
    for (const size of preferred) {
      const img = json.album.image.find((i) => i.size === size);
      const url = img?.["#text"]?.trim();
      if (url && url.startsWith("http")) {
        const httpsUrl = url.replace(/^http:\/\//i, "https://");
        artCache.set(ck, httpsUrl);
        return httpsUrl;
      }
    }

    artCache.set(ck, null);
    return null;
  } catch (err) {
    console.warn("[lastfm] album art lookup failed", err);
    artCache.set(ck, null);
    return null;
  }
}

export async function getLastFmSession(
  apiKey: string,
  apiSecret: string,
  username: string,
  password: string,
): Promise<string> {
  const json = await apiCall<{ session?: { key?: string } }>(
    {
      method: "auth.getMobileSession",
      api_key: apiKey.trim(),
      username: username.trim(),
      password,
    },
    apiSecret.trim(),
  );
  const sessionKey = json.session?.key?.trim();
  if (!sessionKey) throw new Error("Last.fm did not return a session key.");
  return sessionKey;
}

export interface ScrobbleTrack {
  artist: string;
  title: string;
  album?: string;
  durationSec?: number;
  timestamp: number;
}

export async function updateNowPlaying(
  apiKey: string,
  apiSecret: string,
  sessionKey: string,
  track: Omit<ScrobbleTrack, "timestamp">,
): Promise<void> {
  const params: Record<string, string> = {
    method: "track.updateNowPlaying",
    api_key: apiKey.trim(),
    sk: sessionKey,
    artist: track.artist,
    track: track.title,
  };
  if (track.album) params.album = track.album;
  if (track.durationSec != null) params.duration = String(Math.round(track.durationSec));
  await apiCall(params, apiSecret.trim());
}

export async function scrobbleTrack(
  apiKey: string,
  apiSecret: string,
  sessionKey: string,
  track: ScrobbleTrack,
): Promise<void> {
  const params: Record<string, string> = {
    method: "track.scrobble",
    api_key: apiKey.trim(),
    sk: sessionKey,
    "artist[0]": track.artist,
    "track[0]": track.title,
    "timestamp[0]": String(track.timestamp),
  };
  if (track.album) params["album[0]"] = track.album;
  if (track.durationSec != null) params["duration[0]"] = String(Math.round(track.durationSec));
  await apiCall(params, apiSecret.trim());
}

/** Last.fm scrobble threshold: half the track or 4 minutes, whichever is lower. */
export function scrobbleThresholdMs(durationMs: number): number {
  if (durationMs < 30_000) return Number.POSITIVE_INFINITY;
  return Math.min(durationMs / 2, 240_000);
}

export interface LastFmArtistInfo {
  name: string;
  url?: string;
  listeners?: string;
  playcount?: string;
  bio?: string;
  tags: string[];
  similar: { name: string; url?: string; image?: string }[];
  image?: string;
}

function pickImage(images?: { size?: string; ["#text"]?: string }[]): string | undefined {
  if (!images?.length) return undefined;
  const preferred = ["mega", "extralarge", "large", "medium"];
  // Last.fm's generic star silhouette — treat as "no image".
  const PLACEHOLDER = "2a96cbd8b46e442fc41c2b86b821562f";
  for (const size of preferred) {
    const img = images.find((i) => i.size === size);
    const url = img?.["#text"]?.trim();
    if (url && url.startsWith("http") && !url.includes(PLACEHOLDER)) {
      return url.replace(/^http:\/\//i, "https://");
    }
  }
  return undefined;
}

export async function fetchLastFmArtistInfo(
  apiKey: string,
  artist: string,
): Promise<LastFmArtistInfo | null> {
  const key = apiKey.trim();
  const name = artist.trim();
  if (!key || !name) return null;

  try {
    const params = new URLSearchParams({
      method: "artist.getinfo",
      api_key: key,
      artist: name,
      autocorrect: "1",
      format: "json",
    });
    const res = await fetch(`${API_BASE}?${params.toString()}`);
    if (!res.ok) return null;
    const json = (await res.json()) as {
      artist?: {
        name?: string;
        url?: string;
        stats?: { listeners?: string; playcount?: string };
        bio?: { content?: string; summary?: string };
        tags?: { tag?: { name?: string }[] };
        similar?: { artist?: { name?: string; url?: string; image?: { size?: string; ["#text"]?: string }[] }[] };
        image?: { size?: string; ["#text"]?: string }[];
      };
      error?: number;
    };
    if (json.error || !json.artist) return null;
    const a = json.artist;
    if (!a.name) return null;
    const artistName = a.name;
    const summary = (a.bio?.summary || a.bio?.content || "")
      .replace(/<a[^>]*>.*?<\/a>/gi, "")
      .replace(/<[^>]+>/g, "")
      .trim();

    return {
      name: artistName,
      url: a.url,
      listeners: a.stats?.listeners,
      playcount: a.stats?.playcount,
      bio: summary || undefined,
      tags: (a.tags?.tag ?? []).map((t) => t.name).filter((t): t is string => Boolean(t)),
      similar: (a.similar?.artist ?? []).map((s) => ({
        name: s.name ?? "",
        url: s.url,
        image: pickImage(s.image),
      })).filter((s) => s.name),
      image: pickImage(a.image),
    };
  } catch (err) {
    console.warn("[lastfm] artist info failed", err);
    return null;
  }
}

export function formatCompactCount(value?: string | number): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (n == null || Number.isNaN(n)) return "—";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}
