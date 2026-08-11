/** Last.fm album art lookup (same approach as AMWin-RP: album.getinfo → mega image). */

const cache = new Map<string, string | null>();

function cleanAlbumName(album: string): string {
  return album
    .replace(/\s*[([].*(deluxe|remaster|anniversary|expanded|edition|explicit).*[)\]]/gi, "")
    .replace(/\s*-\s*(deluxe|remastered?|anniversary).*$/gi, "")
    .trim();
}

function cacheKey(artist: string, album: string): string {
  return `${artist.toLowerCase().trim()}::${cleanAlbumName(album).toLowerCase()}`;
}

/**
 * Returns a public HTTPS image URL Discord can fetch, or null.
 */
export async function fetchLastFmAlbumArt(
  apiKey: string,
  artist: string,
  album: string,
): Promise<string | null> {
  const key = apiKey.trim();
  if (!key || !artist.trim() || !album.trim()) return null;

  const ck = cacheKey(artist, album);
  if (cache.has(ck)) return cache.get(ck) ?? null;

  try {
    const params = new URLSearchParams({
      method: "album.getinfo",
      api_key: key,
      artist: artist.trim(),
      album: cleanAlbumName(album),
      format: "json",
    });
    const res = await fetch(`https://ws.audioscrobbler.com/2.0/?${params.toString()}`);
    if (!res.ok) {
      cache.set(ck, null);
      return null;
    }
    const json = (await res.json()) as {
      album?: { image?: { size?: string; ["#text"]?: string }[] };
      error?: number;
    };
    if (json.error || !json.album?.image) {
      cache.set(ck, null);
      return null;
    }

    const preferred = ["mega", "extralarge", "large"];
    for (const size of preferred) {
      const img = json.album.image.find((i) => i.size === size);
      const url = img?.["#text"]?.trim();
      if (url && url.startsWith("http")) {
        const httpsUrl = url.replace(/^http:\/\//i, "https://");
        cache.set(ck, httpsUrl);
        return httpsUrl;
      }
    }

    cache.set(ck, null);
    return null;
  } catch (err) {
    console.warn("[lastfm] album art lookup failed", err);
    cache.set(ck, null);
    return null;
  }
}
