import { useUpdater } from "./UpdaterContext";
import { APP_NAME } from "../../lib/constants";

/** "Updates" section of the Settings page. */
export function UpdateCard() {
  const {
    stage,
    currentVersion,
    newVersion,
    notes,
    progress,
    error,
    checkForUpdate,
    downloadAndInstall,
    restart,
  } = useUpdater();

  const busy = stage === "checking" || stage === "downloading" || stage === "installing";

  return (
    <section className="settings-card">
      <header className="settings-card-head">
        <div className="settings-card-title-row">
          <h2>Updates</h2>
          <span className={`status-badge${stage === "current" ? " ok" : ""}`}>
            {currentVersion ? `v${currentVersion}` : "—"}
          </span>
        </div>
        <p className="muted">
          {APP_NAME} checks for a new version on launch and installs it in place — your settings,
          server and queue are kept.
        </p>
      </header>

      {(stage === "available" || stage === "downloading" || stage === "installing") && (
        <div className="update-row">
          <p className="update-row-title">Version {newVersion} available</p>
          {notes && <p className="muted update-notes">{notes}</p>}
          {(stage === "downloading" || stage === "installing") && (
            <div className="update-progress">
              <div
                className={`update-progress-fill${progress === null ? " indeterminate" : ""}`}
                style={progress === null ? undefined : { width: `${progress}%` }}
              />
            </div>
          )}
        </div>
      )}

      {stage === "current" && <p className="success-msg">You're on the latest version.</p>}
      {stage === "ready" && (
        <p className="success-msg">Update installed. Restart {APP_NAME} to finish.</p>
      )}
      {stage === "error" && error && <p className="error">{error}</p>}

      <div className="settings-save-bar">
        {stage === "ready" ? (
          <button className="btn" type="button" onClick={() => void restart()}>
            Restart now
          </button>
        ) : stage === "available" || stage === "downloading" || stage === "installing" ? (
          <button
            className="btn"
            type="button"
            disabled={busy}
            onClick={() => void downloadAndInstall()}
          >
            {stage === "downloading"
              ? progress === null
                ? "Downloading…"
                : `Downloading… ${progress}%`
              : stage === "installing"
                ? "Installing…"
                : `Update to ${newVersion}`}
          </button>
        ) : (
          <button
            className="btn"
            type="button"
            disabled={busy}
            onClick={() => void checkForUpdate()}
          >
            {stage === "checking" ? "Checking…" : "Check for updates"}
          </button>
        )}
      </div>
    </section>
  );
}
