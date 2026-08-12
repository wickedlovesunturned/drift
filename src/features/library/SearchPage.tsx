import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useSettings } from "../settings/SettingsContext";
import {
  coverArtUrl,
  formatDuration,
  search3,
  type Album,
  type Artist,
  type Song,
} from "../../lib/subsonic/client";
import { Cover, AlbumCard } from "./Cover";
import { usePlayer, type PlayerTrack } from "../player/PlayerContext";

export function SearchPage() {
  const [params] = useSearchParams();
  const query = (params.get("q") ?? "").trim();
  const { auth } = useSettings();
  const { playTracks } = usePlayer();
  const [artists, setArtists] = useState<Artist[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [covers, setCovers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth || !query) {
      setArtists([]);
      setAlbums([]);
      setSongs([]);
      setCovers({});
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await search3(auth, query);
        const nextArtists = result.artist ?? [];
        const nextAlbums = result.album ?? [];
        const nextSongs = result.song ?? [];
        const map: Record<string, string> = {};
        await Promise.all([
          ...nextArtists.map(async (a) => {
            if (a.artistImageUrl) {
              map[`artist:${a.id}`] = a.artistImageUrl;
              return;
            }
            const url = await coverArtUrl(auth, a.coverArt ?? a.id, 120);
            if (url) map[`artist:${a.id}`] = url;
          }),
          ...nextAlbums.map(async (a) => {
            const url = await coverArtUrl(auth, a.coverArt ?? a.id, 300);
            if (url) map[`album:${a.id}`] = url;
          }),
          ...nextSongs.map(async (s) => {
            const url = await coverArtUrl(auth, s.coverArt, 80);
            if (url) map[`song:${s.id}`] = url;
          }),
        ]);
        if (!cancelled) {
          setArtists(nextArtists);
          setAlbums(nextAlbums);
          setSongs(nextSongs);
          setCovers(map);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [auth, query]);

  const empty = useMemo(
    () => !loading && !error && query && artists.length + albums.length + songs.length === 0,
    [loading, error, query, artists.length, albums.length, songs.length],
  );

  async function playSongAt(index: number) {
    if (!auth || !songs.length) return;
    const tracks: PlayerTrack[] = await Promise.all(
      songs.map(async (s) => ({
        ...s,
        coverUrl: covers[`song:${s.id}`] ?? (await coverArtUrl(auth, s.coverArt, 300)),
      })),
    );
    await playTracks(tracks, index, {
      source: { kind: "search", name: query ? `Search: ${query}` : "Search" },
    });
  }

  return (
    <div>
      <h1 className="section-title">Search</h1>
      <p className="section-sub">
        {query ? `Results for "${query}"` : "Type in the sidebar search to find local music."}
      </p>

      {!query && <p className="empty">Search your Navidrome library from the sidebar.</p>}
      {loading && <p className="muted">Searching...</p>}
      {error && <p className="error">{error}</p>}
      {empty && <p className="empty">No matches in your library.</p>}

      {songs.length > 0 && (
        <section className="rail">
          <h2>Songs</h2>
          <ul className="track-list">
            {songs.map((song, i) => (
              <li key={song.id} className="track-row" onClick={() => void playSongAt(i)}>
                <span className="num">{i + 1}</span>
                <span className="search-song">
                  <Cover src={covers[`song:${song.id}`]} className="search-song-cover" alt="" />
                  <span>
                    <div>{song.title}</div>
                    <div className="muted" style={{ fontSize: "0.85rem" }}>
                      {song.artist}
                      {song.album ? ` · ${song.album}` : ""}
                    </div>
                  </span>
                </span>
                <span className="dur">{formatDuration(song.duration)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {albums.length > 0 && (
        <section className="rail">
          <h2>Albums</h2>
          <div className="album-grid">
            {albums.map((album) => (
              <AlbumCard key={album.id} album={album} coverUrl={covers[`album:${album.id}`]} />
            ))}
          </div>
        </section>
      )}

      {artists.length > 0 && (
        <section className="rail">
          <h2>Artists</h2>
          <ul className="artist-list">
            {artists.map((artist) => {
              const avatar = covers[`artist:${artist.id}`];
              return (
                <li key={artist.id}>
                  <Link className="artist-row" to={`/artist/${artist.id}`}>
                    {avatar ? (
                      <img src={avatar} alt="" className="artist-row-avatar" />
                    ) : (
                      <div className="artist-row-avatar placeholder" />
                    )}
                    <span className="artist-row-meta">
                      <span className="name">{artist.name}</span>
                      {artist.albumCount != null ? (
                        <span className="muted">{artist.albumCount} albums</span>
                      ) : null}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
