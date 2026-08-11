import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useSettings } from "../settings/SettingsContext";
import {
  coverArtUrl,
  formatDuration,
  getAlbum,
  type Album,
  type Song,
} from "../../lib/subsonic/client";
import { Cover } from "./Cover";
import { usePlayer, type PlayerTrack } from "../player/PlayerContext";

export function AlbumPage() {
  const { id } = useParams();
  const { auth } = useSettings();
  const { playTracks } = usePlayer();
  const [album, setAlbum] = useState<(Album & { song?: Song[] }) | null>(null);
  const [cover, setCover] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth || !id) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await getAlbum(auth, id);
        const url = await coverArtUrl(auth, data.coverArt ?? data.id, 600);
        if (!cancelled) {
          setAlbum(data);
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

  async function playFrom(index: number) {
    if (!album?.song?.length || !auth) return;
    const tracks: PlayerTrack[] = await Promise.all(
      album.song.map(async (s) => ({
        ...s,
        album: s.album ?? album.name,
        coverUrl:
          (await coverArtUrl(auth, s.coverArt ?? album.coverArt ?? album.id, 300)) ?? cover,
      })),
    );
    await playTracks(tracks, index);
  }

  if (error) return <p className="error">{error}</p>;
  if (!album) return <p className="muted">Loading album…</p>;

  return (
    <div>
      <div className="detail-hero">
        <Cover src={cover} />
        <div>
          <p className="muted" style={{ margin: "0 0 0.35rem" }}>
            Album
          </p>
          <h1>{album.name}</h1>
          <p className="muted" style={{ margin: "0 0 1rem" }}>
            {album.artist}
            {album.year ? ` · ${album.year}` : ""}
          </p>
          <button className="btn" type="button" onClick={() => void playFrom(0)}>
            Play
          </button>
        </div>
      </div>
      <ul className="track-list">
        {(album.song ?? []).map((song, i) => (
          <li
            key={song.id}
            className="track-row"
            onDoubleClick={() => void playFrom(i)}
            onClick={() => void playFrom(i)}
          >
            <span className="num">{song.track ?? i + 1}</span>
            <span>
              <div>{song.title}</div>
              <div className="muted" style={{ fontSize: "0.85rem" }}>
                {song.artist}
              </div>
            </span>
            <span className="dur">{formatDuration(song.duration)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
