import { useUpdater } from "./UpdaterContext";

/**
 * Slim prompt that appears once an update is found. Positioned above the player
 * bar so it never covers transport controls.
 */
export function UpdateToast() {
  const { stage, newVersion, progress, dismissed, dismiss, downloadAndInstall, restart } =
    useUpdater();

  const visible =
    !dismissed && (stage === "available" || stage === "downloading" || stage === "installing" || stage === "ready");
  if (!visible) return null;

  const busy = stage === "downloading" || stage === "installing";

  return (
    <div className="update-toast" role="status" aria-live="polite">
      <div className="update-toast-copy">
        <p className="update-toast-title">
          {stage === "ready" ? "Update ready" : `drift ${newVersion} is available`}
        </p>
        <p className="muted update-toast-sub">
          {stage === "downloading" &&
            (progress === null ? "Downloading…" : `Downloading… ${progress}%`)}
          {stage === "installing" && "Installing…"}
          {stage === "ready" && "Restart to finish."}
          {stage === "available" && "Downloads and installs in the background."}
        </p>
      </div>

      {busy && (
        <div className="update-progress" aria-hidden="true">
          <div
            className={`update-progress-fill${progress === null ? " indeterminate" : ""}`}
            style={progress === null ? undefined : { width: `${progress}%` }}
          />
        </div>
      )}

      <div className="update-toast-actions">
        {stage === "available" && (
          <button className="btn update-btn" type="button" onClick={() => void downloadAndInstall()}>
            Update
          </button>
        )}
        {stage === "ready" && (
          <button className="btn update-btn" type="button" onClick={() => void restart()}>
            Restart
          </button>
        )}
        {!busy && (
          <button className="update-toast-later" type="button" onClick={dismiss}>
            Later
          </button>
        )}
      </div>
    </div>
  );
}
