import { useEffect, useMemo, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { APP_NAME } from "../../lib/constants";
import { useNavHistory } from "./useNavHistory";
import {
  IconChevronLeft,
  IconChevronRight,
  IconWinClose,
  IconWinMaximize,
  IconWinMinimize,
  IconWinRestore,
} from "./icons";

export function TitleBar({ showNav }: { showNav: boolean }) {
  const { canGoBack, canGoForward, goBack, goForward } = useNavHistory();
  const [maximized, setMaximized] = useState(false);

  // Resolves to null outside Tauri so `npm run dev` in a plain browser still renders.
  const appWindow = useMemo(() => {
    try {
      return getCurrentWindow();
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!appWindow) return;
    let active = true;
    const sync = () => {
      void appWindow.isMaximized().then((value) => {
        if (active) setMaximized(value);
      });
    };
    sync();
    const unlisten = appWindow.onResized(sync);
    return () => {
      active = false;
      void unlisten.then((off) => off());
    };
  }, [appWindow]);

  return (
    <div className="titlebar" data-tauri-drag-region>
      <div className="titlebar-nav" data-tauri-drag-region>
        {showNav && (
          <>
            <button
              type="button"
              className="titlebar-nav-btn"
              onClick={goBack}
              disabled={!canGoBack}
              aria-label="Back"
              title="Back"
            >
              <IconChevronLeft size={16} />
            </button>
            <button
              type="button"
              className="titlebar-nav-btn"
              onClick={goForward}
              disabled={!canGoForward}
              aria-label="Forward"
              title="Forward"
            >
              <IconChevronRight size={16} />
            </button>
          </>
        )}
      </div>

      <div className="titlebar-brand" data-tauri-drag-region>
        <img className="titlebar-mark" src="/logo.png" alt="" data-tauri-drag-region />
        <span className="titlebar-title" data-tauri-drag-region>
          {APP_NAME}
        </span>
      </div>

      {/* Spacer is draggable; window buttons stay no-drag via CSS. */}
      <div className="titlebar-controls" data-tauri-drag-region>
        <div className="titlebar-drag-spacer" data-tauri-drag-region />
        <button
          type="button"
          className="win-btn"
          onClick={() => void appWindow?.minimize()}
          aria-label="Minimize"
          title="Minimize"
        >
          <IconWinMinimize />
        </button>
        <button
          type="button"
          className="win-btn"
          onClick={() => void appWindow?.toggleMaximize()}
          aria-label={maximized ? "Restore" : "Maximize"}
          title={maximized ? "Restore" : "Maximize"}
        >
          {maximized ? <IconWinRestore /> : <IconWinMaximize />}
        </button>
        <button
          type="button"
          className="win-btn close"
          onClick={() => void appWindow?.close()}
          aria-label="Close"
          title="Close"
        >
          <IconWinClose />
        </button>
      </div>
    </div>
  );
}
