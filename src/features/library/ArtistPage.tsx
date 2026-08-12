import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useSettings } from "../settings/SettingsContext";
import {
  coverArtUrl,
  getArtist,
  type Album,
  type Artist,
} from "../../lib/subsonic/client";
import {
  fetchLastFmArtistInfo,
  formatCompactCount,
  type LastFmArtistInfo,
} from "../../lib/lastfm";
import { AlbumCard } from "./Cover";
import { usePlayer, type PlayerTrack } from "../player/PlayerContext";
import { getAlbum } from "../../lib/subsonic/client";

export function ArtistPage() {
  const { id } = useParams();
  const { auth, settings } = useSettings();
  const { playTracks } = usePlayer();
  const [artist, setArtist] = useState<(Artist & { album?: Album[] }) | null>(null);
  const [covers, setCovers] = useState<Record<string, string>>({});
  const [heroCover, setHeroCover] = useState<string | undefined>();
  const [lastFm, setLastFm] = useState<LastFmArtistInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!auth || !id) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await getArtist(auth, id);
        const map: Record<string, string> = {};
        await Promise.all(
          (data.album ?? []).map(async (a) => {
            const url = await coverArtUrl(auth, a.coverArt ?? a.id, 300);
            if (url) map[a.id] = url;
          }),
        );
        const first = data.album?.[0];
        const hero = first
          ? await coverArtUrl(auth, first.coverArt ?? first.id, 800)
          : await coverArtUrl(auth, data.coverArt, 800);
        if (!cancelled) {
          setArtist(data);
          setCovers(map);
          setHeroCover(hero);
        }

        if (settings.lastFmApiKey.trim() && data.name) {
          const info = await fetchLastFmArtistInfo(settings.lastFmApiKey, data.name);
          if (!cancelled) setLastFm(info);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [auth, id, settings.lastFmApiKey]);

  async function playArtist(shuffle = false) {
    if (!auth || !artist?.album?.length) return;
    setBusy(true);
    try {
      const tracks: PlayerTrack[] = [];
      for (const album of artist.album) {
        const full = await getAlbum(auth, album.id);
        for (const song of full.song ?? []) {
          tracks.push({
            ...song,
            album: song.album ?? album.name,
            coverUrl:
              covers[album.id] ??
              (await coverArtUrl(auth, song.coverArt ?? album.coverArt ?? album.id, 300)),
          });
        }
      }
      if (!tracks.length) return;
      await playTracks(tracks, 0, {
        ...(shuffle ? { shuffle: true } : {}),
        source: { kind: "album", id: artist.id, name: artist.name },
      });
    } finally {
      setBusy(false);
    }
  }

  if (error) return <p className="error">{error}</p>;
  if (!artist) return <p className="muted">Loading artist…</p>;

  const banner = lastFm?.image || heroCover;

  return (
    <div className="artist-page">
      <section
        className="artist-hero"
        style={banner ? { ["--artist-banner" as string]: `url(${banner})` } : undefined}
      >
        <div className="artist-hero-shade" />
        <div className="artist-hero-content">
          <p className="artist-eyebrow muted">Artist</p>
          <h1 className="artist-name">{artist.name}</h1>
          <p className="artist-meta muted">
            {artist.albumCount != null ? `${artist.albumCount} albums` : null}
            {lastFm?.listeners
              ? `${artist.albumCount != null ? " · " : ""}${formatCompactCount(lastFm.listeners)} listeners`
              : null}
            {lastFm?.playcount
              ? ` · ${formatCompactCount(lastFm.playcount)} scrobbles`
              : null}
          </p>
          <div className="hero-actions">
            <button
              className="btn"
              type="button"
              disabled={busy || !artist.album?.length}
              onClick={() => void playArtist(false)}
            >
              {busy ? "Loading…" : "Play"}
            </button>
            <button
              className="btn secondary"
              type="button"
              disabled={busy || !artist.album?.length}
              onClick={() => void playArtist(true)}
            >
              Shuffle
            </button>
            {lastFm?.url && (
              <a className="btn secondary" href={lastFm.url} target="_blank" rel="noreferrer">
                Last.fm
              </a>
            )}
          </div>
        </div>
      </section>

      <div className="artist-body">
        <div className="artist-main">
          {lastFm?.bio && (
            <section className="artist-section">
              <h2>About</h2>
              <p className="artist-bio">{lastFm.bio}</p>
              {lastFm.tags.length > 0 && (
                <div className="artist-tags">
                  {lastFm.tags.slice(0, 8).map((tag) => (
                    <span key={tag} className="artist-tag">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </section>
          )}

          <section className="artist-section">
            <h2>Albums</h2>
            {(artist.album ?? []).length === 0 ? (
              <p className="muted">No albums found for this artist.</p>
            ) : (
              <div className="album-grid">
                {(artist.album ?? []).map((album) => (
                  <AlbumCard key={album.id} album={album} coverUrl={covers[album.id]} />
                ))}
              </div>
            )}
          </section>
        </div>

        {lastFm && lastFm.similar.length > 0 && (
          <aside className="artist-aside">
            <h2>Similar artists</h2>
            <ul className="similar-list">
              {lastFm.similar.slice(0, 8).map((s) => (
                <li key={s.name}>
                  <Link
                    className="similar-row"
                    to={`/search?q=${encodeURIComponent(s.name)}`}
                  >
                    {s.image ? (
                      <img src={s.image} alt="" className="similar-avatar" />
                    ) : (
                      <div className="similar-avatar placeholder" />
                    )}
                    <span>{s.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>
    </div>
  );
}
