import { useEffect, useState } from "react";
import { getUser, jukeboxControl } from "../../lib/subsonic/client";
import { useSettings } from "../settings/SettingsContext";
import { usePlayer } from "./PlayerContext";
import { IconDevice } from "./icons";
import { PlayerPopover, usePlayerPopover } from "./PlayerPopover";

export function DevicePicker() {
  const { auth } = useSettings();
  const { queue, currentIndex, playing, pause } = usePlayer();
  const { open, close, toggle, buttonRef } = usePlayerPopover("device-picker");
  const [jukeboxAvailable, setJukeboxAvailable] = useState(false);
  const [device, setDevice] = useState<"local" | "jukebox">("local");

  useEffect(() => {
    if (!auth) return;
    let active = true;
    void getUser(auth).then((user) => { if (active) setJukeboxAvailable(Boolean(user.jukeboxRole)); }).catch(() => { if (active) setJukeboxAvailable(false); });
    return () => { active = false; };
  }, [auth]);

  async function choose(next: "local" | "jukebox") {
    close();
    if (next === "jukebox" && auth && queue.length) {
      try {
        await jukeboxControl(auth, "set", { ids: queue.map((track) => track.id) });
        if (currentIndex >= 0) await jukeboxControl(auth, "skip", { index: currentIndex });
        await jukeboxControl(auth, playing ? "start" : "stop");
        pause();
        setDevice(next);
      } catch {
        // The server may expose jukeboxRole while the feature is disabled in its configuration.
      }
      return;
    }
    setDevice(next);
  }

  return (
    <div className="player-popover-wrap">
      <button ref={buttonRef} type="button" className={`icon-btn ghost${device === "jukebox" || open ? " active" : ""}`} onClick={toggle} aria-expanded={open} aria-label="Playback device" title="Playback device">
        <IconDevice size={16} />
      </button>
      <PlayerPopover open={open} buttonRef={buttonRef} onClose={close} label="Playback device" className="device-popover">
          <strong>Play on</strong>
          <button type="button" className={device === "local" ? "selected" : ""} onClick={() => void choose("local")}><IconDevice size={15} /> This device</button>
          {jukeboxAvailable ? <button type="button" className={device === "jukebox" ? "selected" : ""} onClick={() => void choose("jukebox")}><IconDevice size={15} /> Navidrome Jukebox</button> : <p className="muted">No Navidrome Jukebox is available for this account.</p>}
          <small className="muted">Jukebox plays through audio hardware configured on your Navidrome server.</small>
      </PlayerPopover>
    </div>
  );
}
