import { useEffect, useState } from "react";
import { usePlayer } from "./PlayerContext";
import { IconSpeaker, IconSpeakerMute } from "./icons";

const VISIBLE_MS = 1400;

/** Windows-style flyout that flashes the current level whenever volume changes. */
export function VolumeOsd() {
  const { volume, volumeNudge } = usePlayer();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (volumeNudge === 0) return;
    setVisible(true);
    const id = window.setTimeout(() => setVisible(false), VISIBLE_MS);
    return () => window.clearTimeout(id);
  }, [volumeNudge]);

  const percent = Math.round(volume * 100);

  return (
    <div className={`volume-osd${visible ? " show" : ""}`} aria-hidden={!visible}>
      {percent === 0 ? <IconSpeakerMute size={18} /> : <IconSpeaker size={18} />}
      <div className="volume-osd-track">
        <div className="volume-osd-fill" style={{ width: `${percent}%` }} />
      </div>
      <span className="volume-osd-value">{percent}</span>
    </div>
  );
}
