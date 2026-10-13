export interface QuietWindow {
  /** Minutes after midnight. */
  start: number;
  end: number;
}

/** "23:00-07:00" -> a window; anything malformed is "no quiet hours", never a guess. */
export function parseQuietHours(spec: string | undefined): QuietWindow | null {
  const match = /^\s*([01]?\d|2[0-3]):([0-5]\d)\s*-\s*([01]?\d|2[0-3]):([0-5]\d)\s*$/.exec(
    spec ?? "",
  );
  if (!match) return null;
  const start = Number(match[1]) * 60 + Number(match[2]);
  const end = Number(match[3]) * 60 + Number(match[4]);
  return start === end ? null : { start, end };
}

/** Minutes after midnight in a named time zone (so "23:00" means 23:00 in Warsaw, whatever the server clock says). */
export function minutesInZone(now: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0") % 24;
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

/** A window that crosses midnight (23:00-07:00) is quiet from the start until the end the next morning. */
export function isQuiet(now: Date, window: QuietWindow | null, timeZone: string): boolean {
  if (!window) return false;
  const minutes = minutesInZone(now, timeZone);
  return window.start < window.end
    ? minutes >= window.start && minutes < window.end
    : minutes >= window.start || minutes < window.end;
}
