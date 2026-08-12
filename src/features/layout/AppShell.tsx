import {
  NavLink,
  Outlet,
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { PlayerBar } from "../player/PlayerBar";
import { PlayingNext } from "../player/PlayingNext";
import { LyricsPanel } from "../lyrics/LyricsPanel";
import { VolumeOsd } from "../player/VolumeOsd";
import { usePlayer } from "../player/PlayerContext";
import { useKeyboardShortcuts } from "../player/useKeyboardShortcuts";
import { useFavorites } from "../library/FavoritesContext";
import { useSettings } from "../settings/SettingsContext";
import { getPlaylists, type Playlist } from "../../lib/subsonic/client";
import { APP_NAME } from "../../lib/constants";
import { PLAYLISTS_CHANGED_EVENT } from "../../lib/events";
import { ResizeHandle, clamp, usePersistedWidth } from "./ResizeHandle";

export function AppShell() {
  const { queuePanelOpen, lyricsMode, current, setLyricsMode } = usePlayer();
  const { toggleFavorite } = useFavorites();
  const { auth } = useSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const [navWidth, setNavWidth] = usePersistedWidth("drift.navWidth", 260);
  const [nextWidth, setNextWidth] = usePersistedWidth("drift.nextWidth", 340);
  const [libraryOpen, setLibraryOpen] = useState(true);
  const [playlistsOpen, setPlaylistsOpen] = useState(true);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [searchText, setSearchText] = useState(params.get("q") ?? "");
  const [playlistTick, setPlaylistTick] = useState(0);

  useEffect(() => {
    setSearchText(params.get("q") ?? "");
  }, [params]);

  useEffect(() => {
    function onChanged() {
      setPlaylistTick((n) => n + 1);
    }
    window.addEventListener(PLAYLISTS_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(PLAYLISTS_CHANGED_EVENT, onChanged);
  }, []);

  useEffect(() => {
    if (!auth) {
      setPlaylists([]);
      return;
    }
    let cancelled = false;
    void getPlaylists(auth)
      .then((list) => {
        if (!cancelled) setPlaylists(list);
      })
      .catch(() => {
        if (!cancelled) setPlaylists([]);
      });
    return () => {
      cancelled = true;
    };
  }, [auth, location.pathname, playlistTick]);

  const onNavDrag = useCallback(
    (delta: number) => setNavWidth((w) => clamp(w + delta, 160, 480)),
    [setNavWidth],
  );
  const onNextDrag = useCallback(
    (delta: number) => setNextWidth((w) => clamp(w - delta, 200, 520)),
    [setNextWidth],
  );

  const onToggleFavorite = useCallback(() => {
    if (current) void toggleFavorite(current);
  }, [current, toggleFavorite]);

  useKeyboardShortcuts(onToggleFavorite);

  function onSearchSubmit(e: FormEvent) {
    e.preventDefault();
    const q = searchText.trim();
    if (!q) {
      navigate("/");
      return;
    }
    navigate(`/search?q=${encodeURIComponent(q)}`);
  }

  const sideOpen = queuePanelOpen || lyricsMode === "side";

  return (
    <div
      className={`app-shell${sideOpen ? " queue-open" : " queue-closed"}${lyricsMode === "full" ? " lyrics-full" : ""}`}
      style={
        {
          "--nav-w": `${navWidth}px`,
          "--next-w": `${nextWidth}px`,
        } as CSSProperties
      }
    >
      <PlayerBar />

      <aside className="nav">
        <Link className="nav-brand" to="/" title="Home">
          <img className="brand-mark" src="/logo.png" alt="" />
          <span>{APP_NAME}</span>
        </Link>
        <form className="nav-search" onSubmit={onSearchSubmit}>
          <input
            type="search"
            placeholder="Search"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            aria-label="Search library"
          />
        </form>
        <nav className="nav-links">
          <NavLink className={({ isActive }) => `nav-link${isActive ? " active" : ""}`} to="/" end>
            <span>Home</span>
          </NavLink>

          <button
            type="button"
            className="nav-section-toggle"
            onClick={() => setLibraryOpen((v) => !v)}
          >
            <span>Library</span>
            <span className={`chevron${libraryOpen ? " open" : ""}`}>▾</span>
          </button>
          {libraryOpen && (
            <div className="nav-section">
              <NavLink
                className={({ isActive }) => `nav-link sub${isActive ? " active" : ""}`}
                to="/library"
              >
                <span>Albums</span>
              </NavLink>
              <NavLink
                className={({ isActive }) => `nav-link sub${isActive ? " active" : ""}`}
                to="/favorites"
              >
                <span>Favorites</span>
              </NavLink>
            </div>
          )}

          <button
            type="button"
            className="nav-section-toggle"
            onClick={() => setPlaylistsOpen((v) => !v)}
          >
            <span>Playlists</span>
            <span className={`chevron${playlistsOpen ? " open" : ""}`}>▾</span>
          </button>
          {playlistsOpen && (
            <div className="nav-section nav-playlists">
              {playlists.map((playlist) => (
                <NavLink
                  key={playlist.id}
                  className={({ isActive }) => `nav-link sub${isActive ? " active" : ""}`}
                  to={`/playlist/${playlist.id}`}
                  title={playlist.name}
                >
                  <span className="nav-playlist-name">{playlist.name}</span>
                </NavLink>
              ))}
              <NavLink
                className={({ isActive }) => `nav-link sub nav-all-playlists${isActive ? " active" : ""}`}
                to="/playlists"
              >
                <span>All Playlists</span>
              </NavLink>
            </div>
          )}

          <NavLink
            className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
            to="/settings"
          >
            <span>Settings</span>
          </NavLink>
        </nav>
      </aside>

      <ResizeHandle onDrag={onNavDrag} ariaLabel="Resize sidebar" />

      <main className="main">
        <Outlet />
      </main>

      {lyricsMode === "side" && (
        <>
          <ResizeHandle onDrag={onNextDrag} ariaLabel="Resize lyrics" />
          <aside className="playing-next lyrics-side">
            <LyricsPanel compact onClose={() => setLyricsMode("off")} />
          </aside>
        </>
      )}

      {queuePanelOpen && (
        <>
          <ResizeHandle onDrag={onNextDrag} ariaLabel="Resize Playing Next" />
          <PlayingNext />
        </>
      )}

      {lyricsMode === "full" && (
        <div className="lyrics-fullscreen">
          <LyricsPanel fullscreen onClose={() => setLyricsMode("off")} />
        </div>
      )}

      <VolumeOsd />
    </div>
  );
}
