import { useEffect, useState } from "react";
import { usePlayer } from "./PlayerContext";
import { IconClock } from "./icons";
import { PlayerPopover, usePlayerPopover } from "./PlayerPopover";

const OPTIONS = [15, 30, 45, 60];

export function SleepTimer() {
  const { sleepTimerEndsAt, setSleepTimer } = usePlayer();
  const { open, setOpen, close, toggle, buttonRef } = usePlayerPopover("sleep-timer");
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!sleepTimerEndsAt) {
      setRemaining(0);
      return;
    }
    const update = () => setRemaining(Math.max(0, sleepTimerEndsAt - Date.now()));
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, [sleepTimerEndsAt]);

  const active = Boolean(sleepTimerEndsAt);
  const minutes = Math.ceil(remaining / 60_000);

  return (
    <div className="player-popover-wrap">
      <button
        ref={buttonRef}
        type="button"
        className={`icon-btn ghost${active || open ? " active" : ""}`}
        onClick={toggle}
        aria-label={active ? `Sleep timer: ${minutes} minutes remaining` : "Sleep timer"}
        aria-expanded={open}
        title={active ? `Sleep timer · ${minutes}m left` : "Sleep timer"}
      >
        <IconClock size={16} />
      </button>
      <PlayerPopover open={open} buttonRef={buttonRef} onClose={close} label="Sleep timer" className="sleep-timer-popover">
          <strong>Sleep timer</strong>
          {active && <p className="muted">Pauses in about {minutes} min.</p>}
          <div className="sleep-timer-options">
            {OPTIONS.map((option) => (
              <button key={option} type="button" className="btn tiny secondary" onClick={() => { setSleepTimer(option); setOpen(false); }}>
                {option} min
              </button>
            ))}
          </div>
          {active && <button type="button" className="btn tiny danger" onClick={() => { setSleepTimer(null); setOpen(false); }}>Turn off</button>}
      </PlayerPopover>
    </div>
  );
}
