import { useEffect, useState } from "react";
import { useSettings } from "../settings/SettingsContext";
import { coverArtUrl, getAlbumList2, type Album } from "../../lib/subsonic/client";
import { AlbumCard } from "./Cover";

interface Rail {
  title: string;
  albums: Album[];
  covers: Record<string, string>;
}

export function HomePage() {
  const { auth } = useSettings();
  const [rails, setRails] = useState<Rail[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const defs: { title: string; type: "newest" | "recent" | "frequent" | "starred" }[] = [
          { title: "Recently added", type: "newest" },
          { title: "Recently played", type: "recent" },
          { title: "Most played", type: "frequent" },
          { title: "Starred", type: "starred" },
        ];
        const next: Rail[] = [];
        for (const d of defs) {
          const albums = await getAlbumList2(auth, d.type, 18);
          const covers: Record<string, string> = {};
          await Promise.all(
            albums.map(async (a) => {
              const url = await coverArtUrl(auth, a.coverArt ?? a.id, 300);
              if (url) covers[a.id] = url;
            }),
          );
          if (albums.length) next.push({ title: d.title, albums, covers });
        }
        if (!cancelled) setRails(next);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [auth]);

  return (
    <div>
      <h1 className="section-title">Home</h1>
      <p className="section-sub">Your library, ready to play.</p>
      {loading && <p className="muted">Loading library…</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !error && rails.length === 0 && (
        <p className="empty">No albums yet. Scan your Navidrome library and try again.</p>
      )}
      {rails.map((rail) => (
        <section className="rail" key={rail.title}>
          <h2>{rail.title}</h2>
          <div className="album-grid">
            {rail.albums.map((album) => (
              <AlbumCard key={album.id} album={album} coverUrl={rail.covers[album.id]} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
