import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { getVersion } from "@tauri-apps/api/app";

export type UpdateStage =
  | "idle" // never checked in this session
  | "checking"
  | "current" // checked, already on the newest version
  | "available"
  | "downloading"
  | "installing"
  | "ready" // installed, waiting for the user to restart
  | "error";

interface UpdaterValue {
  stage: UpdateStage;
  /** Version currently running. */
  currentVersion: string;
  /** Version offered by the endpoint, when one is available. */
  newVersion: string | null;
  /** Release notes from latest.json, when the release includes them. */
  notes: string | null;
  /** 0-100 while downloading, null when the server sends no content length. */
  progress: number | null;
  error: string | null;
  /** True when `error` is an expected situation rather than a fault, so the UI can stay calm about it. */
  errorBenign: boolean;
  /** True once the automatic startup check has settled. */
  dismissed: boolean;
  dismiss: () => void;
  checkForUpdate: (opts?: { silent?: boolean }) => Promise<void>;
  downloadAndInstall: () => Promise<void>;
  restart: () => Promise<void>;
}

const UpdaterContext = createContext<UpdaterValue | null>(null);

/** The updater plugin only exists inside the Tauri shell, never in `vite dev` in a browser. */
const IN_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/**
 * Turns updater errors into something a listener would understand. The plugin
 * reports transport-level detail ("Could not fetch a valid release JSON from the
 * remote") which is accurate but means nothing to someone who just wanted to
 * know whether there is a new version.
 */
function messageOf(err: unknown): { message: string; benign: boolean } {
  const raw =
    err instanceof Error ? err.message : typeof err === "string" ? err : "";
  const lower = raw.toLowerCase();

  // No latest.json behind the endpoint. Normal before the first release that
  // ships an update feed, so it is stated plainly rather than in red.
  if (lower.includes("release json") || lower.includes("404")) {
    return {
      message: "No update has been published yet — you're on the newest release available.",
      benign: true,
    };
  }
  if (
    lower.includes("error sending request") ||
    lower.includes("network") ||
    lower.includes("dns") ||
    lower.includes("timed out")
  ) {
    return {
      message: "Couldn't reach the update server. Check your connection and try again.",
      benign: true,
    };
  }
  if (lower.includes("signature")) {
    return {
      message: "The update failed its signature check, so it was not installed.",
      benign: false,
    };
  }
  return { message: raw || "Update failed.", benign: false };
}

export function UpdaterProvider({ children }: { children: ReactNode }) {
  const [stage, setStage] = useState<UpdateStage>("idle");
  const [currentVersion, setCurrentVersion] = useState("");
  const [newVersion, setNewVersion] = useState<string | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorBenign, setErrorBenign] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const fail = useCallback((err: unknown) => {
    const { message, benign } = messageOf(err);
    setError(message);
    setErrorBenign(benign);
    setStage("error");
  }, []);

  // Held between check and install so we do not hit the endpoint twice.
  const pending = useRef<Update | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    if (!IN_TAURI) return;
    void getVersion().then(setCurrentVersion).catch(() => undefined);
  }, []);

  const checkForUpdate = useCallback(async (opts?: { silent?: boolean }) => {
    if (!IN_TAURI || busy.current) return;
    busy.current = true;
    setError(null);
    setStage("checking");
    try {
      const update = await check();
      if (update) {
        pending.current = update;
        setNewVersion(update.version);
        setNotes(update.body?.trim() ? update.body.trim() : null);
        setDismissed(false);
        setStage("available");
      } else {
        pending.current = null;
        setNewVersion(null);
        setStage("current");
      }
    } catch (err) {
      pending.current = null;
      // A failed background check is not worth shouting about — the network
      // being down should not paint an error over the app on launch.
      if (opts?.silent) {
        setStage("idle");
      } else {
        fail(err);
      }
    } finally {
      busy.current = false;
    }
  }, [fail]);

  const downloadAndInstall = useCallback(async () => {
    const update = pending.current;
    if (!update || busy.current) return;
    busy.current = true;
    setError(null);
    setProgress(null);
    setStage("downloading");

    let total = 0;
    let received = 0;

    try {
      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
            total = event.data.contentLength ?? 0;
            setProgress(total > 0 ? 0 : null);
            break;
          case "Progress":
            received += event.data.chunkLength;
            if (total > 0) {
              setProgress(Math.min(100, Math.round((received / total) * 100)));
            }
            break;
          case "Finished":
            setProgress(100);
            setStage("installing");
            break;
        }
      });
      setStage("ready");
    } catch (err) {
      fail(err);
    } finally {
      busy.current = false;
    }
  }, [fail]);

  const restart = useCallback(async () => {
    try {
      await relaunch();
    } catch (err) {
      fail(err);
    }
  }, [fail]);

  const dismiss = useCallback(() => setDismissed(true), []);

  // One quiet check shortly after launch. Delayed so it never competes with
  // the first library fetch for bandwidth.
  useEffect(() => {
    if (!IN_TAURI) return;
    const timer = window.setTimeout(() => {
      void checkForUpdate({ silent: true });
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [checkForUpdate]);

  const value = useMemo<UpdaterValue>(
    () => ({
      stage,
      currentVersion,
      newVersion,
      notes,
      progress,
      error,
      errorBenign,
      dismissed,
      dismiss,
      checkForUpdate,
      downloadAndInstall,
      restart,
    }),
    [
      stage,
      currentVersion,
      newVersion,
      notes,
      progress,
      error,
      errorBenign,
      dismissed,
      dismiss,
      checkForUpdate,
      downloadAndInstall,
      restart,
    ],
  );

  return <UpdaterContext.Provider value={value}>{children}</UpdaterContext.Provider>;
}

export function useUpdater(): UpdaterValue {
  const ctx = useContext(UpdaterContext);
  if (!ctx) throw new Error("useUpdater must be used inside UpdaterProvider");
  return ctx;
}
