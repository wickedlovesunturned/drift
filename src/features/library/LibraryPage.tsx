import { useEffect, useState } from "react";
import { useSettings } from "../settings/SettingsContext";
import { coverArtUrl, getAlbumList2, type Album } from "../../lib/subsonic/client";
import { AlbumCard } from "./Cover";

export function LibraryPage() {
  const { auth } = useSettings();
  const [albums, setAlbums] = useState<Album[]>([]);
  const [covers, setCovers] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await getAlbumList2(auth, "alphabeticalByName", 100);
        const map: Record<string, string> = {};
        await Promise.all(
          list.map(async (a) => {
            const url = await coverArtUrl(auth, a.coverArt ?? a.id, 300);
            if (url) map[a.id] = url;
          }),
        );
        if (!cancelled) {
          setAlbums(list);
          setCovers(map);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [auth]);

  return (
    <div>
      <h1 className="section-title">Library</h1>
      <p className="section-sub">Browse albums alphabetically.</p>
      {error && <p className="error">{error}</p>}
      <div className="album-grid">
        {albums.map((album) => (
          <AlbumCard key={album.id} album={album} coverUrl={covers[album.id]} />
        ))}
      </div>
    </div>
  );
}
