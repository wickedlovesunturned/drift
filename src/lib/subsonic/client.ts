/** Subsonic / Navidrome API client */

export interface AuthConfig {
  serverUrl: string;
  username: string;
  password: string;
}

export interface Album {
  id: string;
  name: string;
  artist?: string;
  artistId?: string;
  coverArt?: string;
  year?: number;
  songCount?: number;
  duration?: number;
}

export interface Song {
  id: string;
  title: string;
  album?: string;
  albumId?: string;
  artist?: string;
  artistId?: string;
  coverArt?: string;
  track?: number;
  duration?: number;
  year?: number;
  /** File size in bytes (Subsonic Child.size) */
  size?: number;
  /** ISO timestamp set by the server when the song is starred. */
  starred?: string;
}

export interface Playlist {
  id: string;
  name: string;
  songCount?: number;
  duration?: number;
  coverArt?: string;
  comment?: string;
}

export interface Artist {
  id: string;
  name: string;
  albumCount?: number;
  coverArt?: string;
  /** External image URL when the server provides one (OpenSubsonic / Navidrome). */
  artistImageUrl?: string;
}

export interface SubsonicUser {
  username?: string;
  jukeboxRole?: boolean;
}

function randomSalt(len = 12): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  for (let i = 0; i < len; i++) out += chars[arr[i] % chars.length];
  return out;
}

export async function md5Hex(text: string): Promise<string> {
  // Chromium WebCrypto does not support MD5; always use the local implementation.
  return md5Fallback(text);
}

/** Pure JS MD5 for environments without WebCrypto MD5 (Chromium). */
function md5Fallback(str: string): string {
  function cmn(q: number, a: number, b: number, x: number, s: number, t: number) {
    a = (a + q + x + t) | 0;
    return (((a << s) | (a >>> (32 - s))) + b) | 0;
  }
  function ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return cmn((b & c) | (~b & d), a, b, x, s, t);
  }
  function gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return cmn((b & d) | (c & ~d), a, b, x, s, t);
  }
  function hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return cmn(b ^ c ^ d, a, b, x, s, t);
  }
  function ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return cmn(c ^ (b | ~d), a, b, x, s, t);
  }
  function md5cycle(x: number[], k: number[]) {
    let [a, b, c, d] = x;
    a = ff(a, b, c, d, k[0], 7, -680876936);
    d = ff(d, a, b, c, k[1], 12, -389564586);
    c = ff(c, d, a, b, k[2], 17, 606105819);
    b = ff(b, c, d, a, k[3], 22, -1044525330);
    a = ff(a, b, c, d, k[4], 7, -176418897);
    d = ff(d, a, b, c, k[5], 12, 1200080426);
    c = ff(c, d, a, b, k[6], 17, -1473231341);
    b = ff(b, c, d, a, k[7], 22, -45705983);
    a = ff(a, b, c, d, k[8], 7, 1770035416);
    d = ff(d, a, b, c, k[9], 12, -1958414417);
    c = ff(c, d, a, b, k[10], 17, -42063);
    b = ff(b, c, d, a, k[11], 22, -1990404162);
    a = ff(a, b, c, d, k[12], 7, 1804603682);
    d = ff(d, a, b, c, k[13], 12, -40341101);
    c = ff(c, d, a, b, k[14], 17, -1502002290);
    b = ff(b, c, d, a, k[15], 22, 1236535329);
    a = gg(a, b, c, d, k[1], 5, -165796510);
    d = gg(d, a, b, c, k[6], 9, -1069501632);
    c = gg(c, d, a, b, k[11], 14, 643717713);
    b = gg(b, c, d, a, k[0], 20, -373897302);
    a = gg(a, b, c, d, k[5], 5, -701558691);
    d = gg(d, a, b, c, k[10], 9, 38016083);
    c = gg(c, d, a, b, k[15], 14, -660478335);
    b = gg(b, c, d, a, k[4], 20, -405537848);
    a = gg(a, b, c, d, k[9], 5, 568446438);
    d = gg(d, a, b, c, k[14], 9, -1019803690);
    c = gg(c, d, a, b, k[3], 14, -187363961);
    b = gg(b, c, d, a, k[8], 20, 1163531501);
    a = gg(a, b, c, d, k[13], 5, -1444681467);
    d = gg(d, a, b, c, k[2], 9, -51403784);
    c = gg(c, d, a, b, k[7], 14, 1735328473);
    b = gg(b, c, d, a, k[12], 20, -1926607734);
    a = hh(a, b, c, d, k[5], 4, -378558);
    d = hh(d, a, b, c, k[8], 11, -2022574463);
    c = hh(c, d, a, b, k[11], 16, 1839030562);
    b = hh(b, c, d, a, k[14], 23, -35309556);
    a = hh(a, b, c, d, k[1], 4, -1530992060);
    d = hh(d, a, b, c, k[4], 11, 1272893353);
    c = hh(c, d, a, b, k[7], 16, -155497632);
    b = hh(b, c, d, a, k[10], 23, -1094730640);
    a = hh(a, b, c, d, k[13], 4, 681279174);
    d = hh(d, a, b, c, k[0], 11, -358537222);
    c = hh(c, d, a, b, k[3], 16, -722521979);
    b = hh(b, c, d, a, k[6], 23, 76029189);
    a = hh(a, b, c, d, k[9], 4, -640364487);
    d = hh(d, a, b, c, k[12], 11, -421815835);
    c = hh(c, d, a, b, k[15], 16, 530742520);
    b = hh(b, c, d, a, k[2], 23, -995338651);
    a = ii(a, b, c, d, k[0], 6, -198630844);
    d = ii(d, a, b, c, k[7], 10, 1126891415);
    c = ii(c, d, a, b, k[14], 15, -1416354905);
    b = ii(b, c, d, a, k[5], 21, -57434055);
    a = ii(a, b, c, d, k[12], 6, 1700485571);
    d = ii(d, a, b, c, k[3], 10, -1894986606);
    c = ii(c, d, a, b, k[10], 15, -1051523);
    b = ii(b, c, d, a, k[1], 21, -2054922799);
    a = ii(a, b, c, d, k[8], 6, 1873313359);
    d = ii(d, a, b, c, k[15], 10, -30611744);
    c = ii(c, d, a, b, k[6], 15, -1560198380);
    b = ii(b, c, d, a, k[13], 21, 1309151649);
    a = ii(a, b, c, d, k[4], 6, -145523070);
    d = ii(d, a, b, c, k[11], 10, -1120210379);
    c = ii(c, d, a, b, k[2], 15, 718787259);
    b = ii(b, c, d, a, k[9], 21, -343485551);
    x[0] = (a + x[0]) | 0;
    x[1] = (b + x[1]) | 0;
    x[2] = (c + x[2]) | 0;
    x[3] = (d + x[3]) | 0;
  }
  function md5blk(s: string) {
    const md5blks: number[] = [];
    for (let i = 0; i < 64; i += 4) {
      md5blks[i >> 2] =
        s.charCodeAt(i) +
        (s.charCodeAt(i + 1) << 8) +
        (s.charCodeAt(i + 2) << 16) +
        (s.charCodeAt(i + 3) << 24);
    }
    return md5blks;
  }
  function md51(s: string) {
    const n = s.length;
    const state = [1732584193, -271733879, -1732584194, 271733878];
    let i: number;
    for (i = 64; i <= n; i += 64) md5cycle(state, md5blk(s.substring(i - 64, i)));
    s = s.substring(i - 64);
    const tail = new Array(16).fill(0);
    for (i = 0; i < s.length; i++) tail[i >> 2] |= s.charCodeAt(i) << (i % 4 << 3);
    tail[i >> 2] |= 0x80 << (i % 4 << 3);
    if (i > 55) {
      md5cycle(state, tail);
      for (i = 0; i < 16; i++) tail[i] = 0;
    }
    tail[14] = n * 8;
    md5cycle(state, tail);
    return state;
  }
  function rhex(n: number) {
    const hex_chr = "0123456789abcdef";
    let s = "";
    for (let j = 0; j < 4; j++) s += hex_chr[(n >> (j * 8 + 4)) & 0x0f] + hex_chr[(n >> (j * 8)) & 0x0f];
    return s;
  }
  return md51(unescape(encodeURIComponent(str))).map(rhex).join("");
}

const CLIENT = "drift";
const API_VERSION = "1.16.1";

export async function buildAuthParams(auth: AuthConfig): Promise<URLSearchParams> {
  const salt = randomSalt();
  const token = await md5Hex(auth.password + salt);
  const params = new URLSearchParams({
    u: auth.username,
    t: token,
    s: salt,
    v: API_VERSION,
    c: CLIENT,
    f: "json",
  });
  return params;
}

function base(auth: AuthConfig): string {
  return auth.serverUrl.replace(/\/+$/, "");
}

async function navidromeToken(auth: AuthConfig): Promise<string> {
  const url = `${base(auth)}/auth/login`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: auth.username,
      password: auth.password,
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} calling auth/login`);
  const json = await res.json();
  const token = json?.token ?? json?.data?.token;
  if (!token || typeof token !== "string") {
    throw new Error("Navidrome authentication token was not returned");
  }
  return token;
}

async function request<T>(
  auth: AuthConfig,
  endpoint: string,
  extra: Record<
    string,
    string | number | boolean | Array<string | number | boolean> | undefined | null
  > = {},
  options: { keepEmptyStrings?: boolean } = {},
): Promise<T> {
  const params = await buildAuthParams(auth);
  for (const [k, v] of Object.entries(extra)) {
    if (v == null) continue;
    if (v === "" && !options.keepEmptyStrings) continue;
    if (Array.isArray(v)) {
      for (const item of v) {
        if (item !== undefined && item !== null && (item !== "" || options.keepEmptyStrings)) {
          params.append(k, String(item));
        }
      }
      continue;
    }
    params.set(k, String(v));
  }
  const url = `${base(auth)}/rest/${endpoint}.view?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} calling ${endpoint}`);
  const json = await res.json();
  const root = json["subsonic-response"];
  if (!root) throw new Error("Invalid Subsonic response");
  if (root.status !== "ok") {
    throw new Error(root.error?.message || `Subsonic error on ${endpoint}`);
  }
  return root as T;
}

export async function ping(auth: AuthConfig): Promise<void> {
  await request(auth, "ping");
}

export async function getAlbumList2(
  auth: AuthConfig,
  type: "newest" | "recent" | "frequent" | "starred" | "alphabeticalByName" | "random",
  size = 24,
): Promise<Album[]> {
  const root = await request<{ albumList2?: { album?: Album[] } }>(auth, "getAlbumList2", {
    type,
    size,
  });
  return root.albumList2?.album ?? [];
}

export async function getAlbum(auth: AuthConfig, id: string): Promise<Album & { song?: Song[] }> {
  const root = await request<{ album?: Album & { song?: Song[] } }>(auth, "getAlbum", { id });
  if (!root.album) throw new Error("Album not found");
  return root.album;
}

export async function getArtists(auth: AuthConfig): Promise<Artist[]> {
  const root = await request<{
    artists?: { index?: { artist?: Artist[] }[] };
  }>(auth, "getArtists");
  const indexes = root.artists?.index ?? [];
  return indexes.flatMap((i) => i.artist ?? []);
}

export async function getArtist(
  auth: AuthConfig,
  id: string,
): Promise<Artist & { album?: Album[] }> {
  const root = await request<{ artist?: Artist & { album?: Album[] } }>(auth, "getArtist", {
    id,
  });
  if (!root.artist) throw new Error("Artist not found");
  return root.artist;
}

export interface ArtistInfo {
  biography?: string;
  musicBrainzId?: string;
  lastFmUrl?: string;
  smallImageUrl?: string;
  mediumImageUrl?: string;
  largeImageUrl?: string;
  similarArtist?: Artist[];
}

/** External metadata + images (Last.fm / MusicBrainz via Navidrome). */
export async function getArtistInfo2(auth: AuthConfig, id: string): Promise<ArtistInfo | null> {
  try {
    const root = await request<{ artistInfo2?: ArtistInfo }>(auth, "getArtistInfo2", {
      id,
      count: 8,
    });
    return root.artistInfo2 ?? null;
  } catch {
    return null;
  }
}

export async function getRandomSongs(auth: AuthConfig, size = 20): Promise<Song[]> {
  const root = await request<{ randomSongs?: { song?: Song[] } }>(auth, "getRandomSongs", {
    size,
  });
  return root.randomSongs?.song ?? [];
}

export async function getSimilarSongs(auth: AuthConfig, id: string, count = 20): Promise<Song[]> {
  const root = await request<{ similarSongs?: { song?: Song[] } }>(auth, "getSimilarSongs", {
    id,
    count,
  });
  return root.similarSongs?.song ?? [];
}

export async function getUser(auth: AuthConfig): Promise<SubsonicUser> {
  const root = await request<{ user?: SubsonicUser }>(auth, "getUser", { username: auth.username });
  return root.user ?? {};
}

export type JukeboxAction = "get" | "status" | "set" | "start" | "stop" | "skip" | "add" | "clear" | "remove" | "shuffle" | "setGain";

export async function jukeboxControl(
  auth: AuthConfig,
  action: JukeboxAction,
  options: { ids?: string[]; index?: number; offset?: number; gain?: number } = {},
): Promise<void> {
  await request(auth, "jukeboxControl", {
    action,
    id: options.ids,
    index: options.index,
    offset: options.offset,
    gain: options.gain,
  });
}

export async function getPlaylists(auth: AuthConfig): Promise<Playlist[]> {
  const root = await request<{ playlists?: { playlist?: Playlist[] } }>(auth, "getPlaylists");
  return root.playlists?.playlist ?? [];
}

export async function getPlaylist(
  auth: AuthConfig,
  id: string,
): Promise<Playlist & { entry?: Song[] }> {
  const root = await request<{ playlist?: Playlist & { entry?: Song[] } }>(auth, "getPlaylist", {
    id,
  });
  if (!root.playlist) throw new Error("Playlist not found");
  return root.playlist;
}

export async function createPlaylist(
  auth: AuthConfig,
  name: string,
  songIds: string[] = [],
): Promise<Playlist> {
  const root = await request<{ playlist?: Playlist }>(auth, "createPlaylist", {
    name,
    ...(songIds.length ? { songId: songIds } : {}),
  });
  if (!root.playlist) throw new Error("Playlist was not created");
  return root.playlist;
}

export async function updatePlaylist(
  auth: AuthConfig,
  playlistId: string,
  updates: { name?: string; comment?: string; public?: boolean },
): Promise<void> {
  await request(auth, "updatePlaylist", {
    playlistId,
    name: updates.name,
    comment: updates.comment,
    public: updates.public,
  }, { keepEmptyStrings: true });
}

export async function addSongsToPlaylist(
  auth: AuthConfig,
  playlistId: string,
  songIds: string[],
): Promise<void> {
  if (!songIds.length) return;
  await request(auth, "updatePlaylist", {
    playlistId,
    songIdToAdd: songIds,
  });
}

export async function setPlaylistSongs(
  auth: AuthConfig,
  playlistId: string,
  songIds: string[],
): Promise<void> {
  await request(auth, "createPlaylist", {
    playlistId,
    songId: songIds,
  });
}

export async function deletePlaylist(auth: AuthConfig, id: string): Promise<void> {
  await request(auth, "deletePlaylist", { id });
}

export async function uploadPlaylistCover(
  auth: AuthConfig,
  playlistId: string,
  file: File,
): Promise<void> {
  const token = await navidromeToken(auth);
  const form = new FormData();
  form.append("image", file);
  const res = await fetch(`${base(auth)}/api/playlist/${encodeURIComponent(playlistId)}/image`, {
    method: "POST",
    headers: {
      // Navidrome native API only reads X-ND-Authorization (Bearer <jwt>).
      "X-ND-Authorization": `Bearer ${token}`,
    },
    body: form,
  });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error("Not allowed to upload playlist cover on this server");
    }
    if (res.status === 400) {
      throw new Error("Cover must be JPEG, PNG, GIF, or WebP (max 10 MB)");
    }
    throw new Error(`HTTP ${res.status} uploading playlist image`);
  }
}

export async function deletePlaylistCover(auth: AuthConfig, playlistId: string): Promise<void> {
  const token = await navidromeToken(auth);
  const res = await fetch(`${base(auth)}/api/playlist/${encodeURIComponent(playlistId)}/image`, {
    method: "DELETE",
    headers: {
      "X-ND-Authorization": `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error("Not allowed to remove playlist cover on this server");
    }
    throw new Error(`HTTP ${res.status} removing playlist image`);
  }
}

export async function search3(auth: AuthConfig, query: string) {
  const root = await request<{
    searchResult3?: { artist?: Artist[]; album?: Album[]; song?: Song[] };
  }>(auth, "search3", { query, artistCount: 10, albumCount: 20, songCount: 20 });
  return root.searchResult3 ?? {};
}

export async function star(auth: AuthConfig, id: string): Promise<void> {
  await request(auth, "star", { id });
}

export async function unstar(auth: AuthConfig, id: string): Promise<void> {
  await request(auth, "unstar", { id });
}

export async function getStarredSongs(auth: AuthConfig): Promise<Song[]> {
  const root = await request<{ starred2?: { song?: Song[] } }>(auth, "getStarred2");
  return root.starred2?.song ?? [];
}

export async function getLyrics(
  auth: AuthConfig,
  artist: string,
  title: string,
): Promise<{ artist?: string; title?: string; value?: string } | null> {
  const root = await request<{ lyrics?: { artist?: string; title?: string; value?: string } }>(
    auth,
    "getLyrics",
    { artist, title },
  );
  return root.lyrics ?? null;
}

export interface StructuredLyrics {
  synced?: boolean;
  offset?: number;
  line?: { start?: number; value?: string }[];
  cueLine?: {
    index?: number;
    start?: number;
    end?: number;
    value?: string;
    cue?: { start?: number; end?: number; value?: string }[];
  }[];
}

export async function getLyricsBySongId(
  auth: AuthConfig,
  id: string,
  enhanced = false,
): Promise<StructuredLyrics | null> {
  const root = await request<{ lyricsList?: { structuredLyrics?: StructuredLyrics[] } }>(
    auth,
    "getLyricsBySongId",
    { id, ...(enhanced ? { enhanced: true } : {}) },
  );
  return root.lyricsList?.structuredLyrics?.find((entry) => entry.synced && entry.line?.length) ?? null;
}

export async function coverArtUrl(
  auth: AuthConfig,
  id: string | undefined,
  size = 300,
  cacheBust?: number | string,
): Promise<string | undefined> {
  if (!id) return undefined;
  const params = await buildAuthParams(auth);
  params.set("id", id);
  params.set("size", String(size));
  if (cacheBust != null && cacheBust !== "") params.set("_", String(cacheBust));
  return `${base(auth)}/rest/getCoverArt.view?${params.toString()}`;
}

export async function streamUrl(auth: AuthConfig, id: string): Promise<string> {
  const params = await buildAuthParams(auth);
  params.set("id", id);
  return `${base(auth)}/rest/stream.view?${params.toString()}`;
}

export function formatDuration(seconds?: number): string {
  if (seconds == null || Number.isNaN(seconds)) return "-";
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatBytes(bytes?: number): string {
  if (bytes == null || Number.isNaN(bytes) || bytes <= 0) return "0 MB";
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(gb >= 10 ? 0 : 2)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(mb >= 100 ? 0 : 1)} MB`;
}

export function sumSongStats(songs: Song[]): {
  count: number;
  durationSec: number;
  sizeBytes: number;
} {
  return songs.reduce(
    (acc, song) => ({
      count: acc.count + 1,
      durationSec: acc.durationSec + (song.duration ?? 0),
      sizeBytes: acc.sizeBytes + (song.size ?? 0),
    }),
    { count: 0, durationSec: 0, sizeBytes: 0 },
  );
}
