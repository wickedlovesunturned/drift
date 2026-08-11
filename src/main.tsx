import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import { SettingsProvider } from "./features/settings/SettingsContext";
import { PlayerProvider } from "./features/player/PlayerContext";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HashRouter>
      <SettingsProvider>
        <PlayerProvider>
          <App />
        </PlayerProvider>
      </SettingsProvider>
    </HashRouter>
  </React.StrictMode>,
);
