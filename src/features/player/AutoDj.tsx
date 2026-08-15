import { usePlayer } from "./PlayerContext";
import { PlayerPopover, usePlayerPopover } from "./PlayerPopover";
import { ToggleSwitch } from "../settings/ToggleSwitch";

export function AutoDj() {
  const {
    autoDjEnabled,
    autoDjMode,
    autoDjCount,
    autoDjTrigger,
    setAutoDjEnabled,
    setAutoDjMode,
    setAutoDjCount,
    setAutoDjTrigger,
  } = usePlayer();
  const { open, close, toggle, buttonRef } = usePlayerPopover("auto-dj");

  return (
    <div className="player-popover-wrap">
      <button ref={buttonRef} type="button" className={`dj-button${autoDjEnabled || open ? " active" : ""}`} onClick={toggle} aria-expanded={open} title="Auto DJ">
        DJ
      </button>
      <PlayerPopover open={open} buttonRef={buttonRef} onClose={close} label="Auto DJ" className="auto-dj-popover">
          <ToggleSwitch
            checked={autoDjEnabled}
            onChange={setAutoDjEnabled}
            label="Enable Auto DJ"
            description="Keeps the queue moving"
          />
          <div className="segmented"><button type="button" className={autoDjMode === "similar" ? "active" : ""} onClick={() => setAutoDjMode("similar")}>Similar</button><button type="button" className={autoDjMode === "random" ? "active" : ""} onClick={() => setAutoDjMode("random")}>Random</button></div>
          <label>Items added<select value={autoDjCount} onChange={(e) => setAutoDjCount(Number(e.target.value))}>{[3, 5, 10, 15, 20].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
          <label>Start when this many remain<input type="range" min="1" max="5" value={autoDjTrigger} onChange={(e) => setAutoDjTrigger(Number(e.target.value))} /><small>{autoDjTrigger} song{autoDjTrigger === 1 ? "" : "s"} left</small></label>
          {autoDjMode === "similar" && <p className="muted">Similar mode uses your server’s recommendation data. Random mode works on more Subsonic servers.</p>}
      </PlayerPopover>
    </div>
  );
}
