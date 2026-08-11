import { NavLink, Outlet, useNavigate, useSearchParams } from "react-router-dom";
import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { PlayerBar } from "../player/PlayerBar";
import { PlayingNext } from "../player/PlayingNext";
import { usePlayer } from "../player/PlayerContext";
import { APP_NAME } from "../../lib/constants";
import { ResizeHandle, clamp, usePersistedWidth } from "./ResizeHandle";

export function AppShell() {
  const { queuePanelOpen } = usePlayer();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [navWidth, setNavWidth] = usePersistedWidth("wm.navWidth", 260);
  const [nextWidth, setNextWidth] = usePersistedWidth("wm.nextWidth", 340);
  const [libraryOpen, setLibraryOpen] = useState(true);
  const [playlistsOpen, setPlaylistsOpen] = useState(true);
  const [searchText, setSearchText] = useState(params.get("q") ?? "");

  useEffect(() => {
    setSearchText(params.get("q") ?? "");
  }, [params]);

  const onNavDrag = useCallback(
    (delta: number) => setNavWidth((w) => clamp(w + delta, 160, 480)),
    [setNavWidth],
  );
  const onNextDrag = useCallback(
    (delta: number) => setNextWidth((w) => clamp(w - delta, 200, 520)),
    [setNextWidth],
  );

  function onSearchSubmit(e: FormEvent) {
    e.preventDefault();
    const q = searchText.trim();
    if (!q) {
      navigate("/");
      return;
    }
    navigate(`/search?q=${encodeURIComponent(q)}`);
  }

  return (
    <div
      className={`app-shell${queuePanelOpen ? " queue-open" : " queue-closed"}`}
      style={
        {
          "--nav-w": `${navWidth}px`,
          "--next-w": `${nextWidth}px`,
        } as CSSProperties
      }
    >
      <PlayerBar />

      <aside className="nav">
        <div className="nav-brand">{APP_NAME}</div>
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
          <NavLink className={({ isActive }) => `nav-link${isActive ? " active" : ""}`} to="/">
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
            <div className="nav-section">
              <NavLink
                className={({ isActive }) => `nav-link sub${isActive ? " active" : ""}`}
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

      {queuePanelOpen && (
        <>
          <ResizeHandle onDrag={onNextDrag} ariaLabel="Resize Playing Next" />
          <PlayingNext />
        </>
      )}
    </div>
  );
}
