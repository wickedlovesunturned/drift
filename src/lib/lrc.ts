/** Parse LRC synced lyrics into timestamped lines. */

export interface LrcLine {
  timeMs: number;
  text: string;
  cues?: LrcCue[];
}

export interface LrcCue {
  timeMs: number;
  endMs?: number;
  text: string;
}

const LINE_RE = /^\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]\s*(.*)$/;

export function parseLrc(raw: string): LrcLine[] {
  const lines: LrcLine[] = [];
  const offsetMatch = raw.match(/^\[offset:\s*([+-]?\d+)\]/im);
  const offsetMs = offsetMatch ? Number(offsetMatch[1]) : 0;
  for (const row of raw.split(/\r?\n/)) {
    const trimmed = row.trim();
    if (!trimmed) continue;

    // Some files repeat timestamps on one physical line: [00:12.00]foo [00:15.00]bar
    const parts = trimmed.split(/(?=\[\d)/);
    for (const part of parts) {
      const match = part.match(LINE_RE);
      if (!match) continue;
      const mins = Number(match[1]);
      const secs = Number(match[2]);
      const frac = match[3] ? Number(match[3].padEnd(3, "0")) : 0;
      const text = match[4]?.trim() ?? "";
      if (!text) continue;
      lines.push({ timeMs: Math.max(0, mins * 60_000 + secs * 1000 + frac + offsetMs), text });
    }
  }

  return lines.sort((a, b) => a.timeMs - b.timeMs);
}

export function isLrcFormat(text: string): boolean {
  return /^\[\d{1,2}:\d{2}(?:\.\d{1,3})?\]/m.test(text);
}

export function plainLyricsLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

export function activeLineIndex(lines: LrcLine[], positionMs: number, offsetMs = 0): number {
  const t = positionMs + offsetMs;
  let idx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].timeMs <= t) idx = i;
    else break;
  }
  return idx;
}
