import { useEffect, useState } from "react";
import { useSettings } from "../settings/SettingsContext";
import { coverArtUrl, getPlaylists, type Playlist } from "../../lib/subsonic/client";
import { PlaylistCard } from "./Cover";

export function PlaylistsPage() {
  const { auth } = useSettings();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [covers, setCovers] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await getPlaylists(auth);
        const map: Record<string, string> = {};
        await Promise.all(
          list.map(async (p) => {
            const url = await coverArtUrl(auth, p.coverArt ?? p.id, 300);
            if (url) map[p.id] = url;
          }),
        );
        if (!cancelled) {
          setPlaylists(list);
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
      <h1 className="section-title">Playlists</h1>
      <p className="section-sub">Playlists from your Navidrome server.</p>
      {error && <p className="error">{error}</p>}
      {!error && playlists.length === 0 && <p className="empty">No playlists found.</p>}
      <div className="album-grid">
        {playlists.map((playlist) => (
          <PlaylistCard
            key={playlist.id}
            playlist={playlist}
            coverUrl={covers[playlist.id]}
          />
        ))}
      </div>
    </div>
  );
}
