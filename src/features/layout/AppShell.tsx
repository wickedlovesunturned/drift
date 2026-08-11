import { NavLink, Outlet } from "react-router-dom";
import { PlayerBar } from "../player/PlayerBar";
import { PlayingNext } from "../player/PlayingNext";
import { usePlayer } from "../player/PlayerContext";
import { APP_NAME } from "../../lib/constants";

export function AppShell() {
  const { queuePanelOpen } = usePlayer();

  return (
    <div className={`app-shell${queuePanelOpen ? " queue-open" : " queue-closed"}`}>
      <aside className="nav">
        <div className="nav-brand">{APP_NAME}</div>
        <nav className="nav-links">
          <NavLink className={({ isActive }) => `nav-link${isActive ? " active" : ""}`} to="/">
            <span>Home</span>
          </NavLink>
          <NavLink
            className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
            to="/library"
          >
            <span>Library</span>
          </NavLink>
          <NavLink
            className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
            to="/playlists"
          >
            <span>Playlists</span>
          </NavLink>
          <NavLink
            className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
            to="/settings"
          >
            <span>Settings</span>
          </NavLink>
        </nav>
      </aside>
      <main className="main">
        <Outlet />
      </main>
      {queuePanelOpen && <PlayingNext />}
      <PlayerBar />
    </div>
  );
}
