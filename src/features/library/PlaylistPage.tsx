import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useSettings } from "../settings/SettingsContext";
import {
  coverArtUrl,
  formatBytes,
  formatDuration,
  getPlaylist,
  sumSongStats,
  type Playlist,
  type Song,
} from "../../lib/subsonic/client";
import { Cover } from "./Cover";
import { usePlayer, type PlayerTrack } from "../player/PlayerContext";

export function PlaylistPage() {
  const { id } = useParams();
  const { auth } = useSettings();
  const { playTracks } = usePlayer();
  const [playlist, setPlaylist] = useState<(Playlist & { entry?: Song[] }) | null>(null);
  const [cover, setCover] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth || !id) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await getPlaylist(auth, id);
        const url = await coverArtUrl(auth, data.coverArt ?? data.id, 600);
        if (!cancelled) {
          setPlaylist(data);
          setCover(url);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [auth, id]);

  const stats = useMemo(() => sumSongStats(playlist?.entry ?? []), [playlist?.entry]);

  async function buildTracks(): Promise<PlayerTrack[]> {
    if (!playlist?.entry?.length || !auth) return [];
    return Promise.all(
      playlist.entry.map(async (s) => ({
        ...s,
        coverUrl: (await coverArtUrl(auth, s.coverArt, 300)) ?? cover,
      })),
    );
  }

  async function playFrom(index: number, shuffle = false) {
    const tracks = await buildTracks();
    if (!tracks.length) return;
    await playTracks(tracks, index, shuffle ? { shuffle: true } : undefined);
  }

  if (error) return <p className="error">{error}</p>;
  if (!playlist) return <p className="muted">Loading playlist...</p>;

  return (
    <div>
      <div className="detail-hero">
        <Cover src={cover} />
        <div>
          <p className="muted" style={{ margin: "0 0 0.35rem" }}>
            Playlist
          </p>
          <h1>{playlist.name}</h1>
          <p className="muted" style={{ margin: "0 0 1rem" }}>
            {stats.count} songs
          </p>
          <div className="hero-actions">
            <button className="btn" type="button" onClick={() => void playFrom(0)}>
              Play
            </button>
            <button
              className="btn secondary"
              type="button"
              onClick={() => void playFrom(0, true)}
            >
              Shuffle
            </button>
          </div>
        </div>
      </div>
      <ul className="track-list">
        {(playlist.entry ?? []).map((song, i) => (
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
          </li>
        ))}
      </ul>
      <footer className="playlist-stats">
        <div>
          <span className="stat-label">Songs</span>
          <span className="stat-value">{stats.count}</span>
        </div>
        <div>
          <span className="stat-label">Length</span>
          <span className="stat-value">{formatDuration(stats.durationSec)}</span>
        </div>
        <div>
          <span className="stat-label">Size</span>
          <span className="stat-value">{formatBytes(stats.sizeBytes)}</span>
        </div>
      </footer>
    </div>
  );
}
