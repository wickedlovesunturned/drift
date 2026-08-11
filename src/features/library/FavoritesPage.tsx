import { useMemo } from "react";
import { useSettings } from "../settings/SettingsContext";
import { coverArtUrl, formatDuration, sumSongStats } from "../../lib/subsonic/client";
import { usePlayer, type PlayerTrack } from "../player/PlayerContext";
import { useFavorites } from "./FavoritesContext";
import { IconStarFilled } from "../player/icons";

export function FavoritesPage() {
  const { auth } = useSettings();
  const { playTracks } = usePlayer();
  const { songs, loading, error, toggleFavorite } = useFavorites();

  const stats = useMemo(() => sumSongStats(songs), [songs]);

  async function playFrom(index: number, shuffle = false) {
    if (!auth || !songs.length) return;
    const tracks: PlayerTrack[] = await Promise.all(
      songs.map(async (s) => ({ ...s, coverUrl: await coverArtUrl(auth, s.coverArt, 300) })),
    );
    await playTracks(tracks, index, {
      ...(shuffle ? { shuffle: true } : {}),
      source: { kind: "queue", name: "Favorites" },
    });
  }

  return (
    <div>
      <h1 className="section-title">Favorites</h1>
      <p className="section-sub">
        {loading
          ? "Loading favorites..."
          : `${stats.count} songs · ${formatDuration(stats.durationSec)}`}
      </p>

      {error && <p className="error">{error}</p>}

      {songs.length > 0 && (
        <div className="hero-actions" style={{ marginBottom: "1.5rem" }}>
          <button className="btn" type="button" onClick={() => void playFrom(0)}>
            Play
          </button>
          <button className="btn secondary" type="button" onClick={() => void playFrom(0, true)}>
            Shuffle
          </button>
        </div>
      )}

      {!loading && songs.length === 0 && !error && (
        <p className="empty">
          Nothing here yet. Tap the star next to a playing song to add it.
        </p>
      )}

      <ul className="track-list with-star">
        {songs.map((song, i) => (
          <li key={song.id} className="track-row" onClick={() => void playFrom(i)}>
            <span className="num">{i + 1}</span>
            <span>
              <div>{song.title}</div>
              <div className="muted" style={{ fontSize: "0.85rem" }}>
                {song.artist}
                {song.album ? ` · ${song.album}` : ""}
              </div>
            </span>
            <span className="dur">{formatDuration(song.duration)}</span>
            <button
              type="button"
              className="icon-btn tiny star active"
              onClick={(e) => {
                e.stopPropagation();
                void toggleFavorite(song);
              }}
              aria-label="Remove from Favorites"
              title="Remove from Favorites"
            >
              <IconStarFilled size={15} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
