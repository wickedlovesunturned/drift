import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useSettings } from "../settings/SettingsContext";
import {
  coverArtUrl,
  createPlaylist,
  getPlaylists,
  type Playlist,
} from "../../lib/subsonic/client";
import { PlaylistCard } from "./Cover";
import { notifyPlaylistsChanged } from "../../lib/events";

export function PlaylistsPage() {
  const navigate = useNavigate();
  const { auth } = useSettings();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [covers, setCovers] = useState<Record<string, string>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
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

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!auth) return;
    const trimmed = name.trim();
    if (!trimmed || creating) return;

    setCreating(true);
    setError(null);
    try {
      const playlist = await createPlaylist(auth, trimmed);
      setPlaylists((prev) => [playlist, ...prev]);
      const coverUrl = await coverArtUrl(auth, playlist.coverArt ?? playlist.id, 300);
      if (coverUrl) {
        setCovers((prev) => ({ ...prev, [playlist.id]: coverUrl }));
      }
      setName("");
      setCreateOpen(false);
      notifyPlaylistsChanged();
      navigate(`/playlist/${playlist.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <div className="section-title-row">
        <h1 className="section-title">Playlists</h1>
        <button className="create-pill-btn" type="button" onClick={() => setCreateOpen(true)}>
          <span className="plus">+</span>
          <span>Create</span>
        </button>
      </div>
      <p className="section-sub">Playlists from your Navidrome server.</p>
      {error && <p className="error">{error}</p>}
      {createOpen && (
        <div className="modal-backdrop" onClick={() => !creating && setCreateOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h2 className="panel-title">Create playlist</h2>
            <form className="form" onSubmit={onCreate}>
              <label>
                Name
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My Playlist"
                  maxLength={120}
                  required
                  autoFocus
                />
              </label>
              <div className="form-actions" style={{ justifyContent: "flex-end", marginTop: 0 }}>
                <button
                  className="btn secondary tiny"
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  disabled={creating}
                >
                  Cancel
                </button>
                <button className="btn tiny" type="submit" disabled={creating || !name.trim()}>
                  {creating ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
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
