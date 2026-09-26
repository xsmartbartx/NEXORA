import { readFile } from "node:fs/promises";

/** Nightly job plus slack for a slow run — past this, a night was missed. */
export const MAX_AGE_MS = 26 * 60 * 60 * 1000;

export interface BackupFreshness {
  status: "ok" | "stale" | "missing";
  lastSuccess: string | null;
}

/**
 * Reads the heartbeat the host's backup script writes (Unix seconds) after
 * a run that succeeded end to end, off-site upload included. Only the
 * timestamp is exposed — nothing about what was backed up or where.
 */
export async function readBackupFreshness(
  file: string,
  now: number = Date.now(),
): Promise<BackupFreshness> {
  let seconds: number;
  try {
    seconds = Number.parseInt((await readFile(file, "utf8")).trim(), 10);
  } catch {
    return { status: "missing", lastSuccess: null };
  }
  if (!Number.isFinite(seconds)) return { status: "missing", lastSuccess: null };

  const lastSuccess = new Date(seconds * 1000);
  return {
    status: now - lastSuccess.getTime() <= MAX_AGE_MS ? "ok" : "stale",
    lastSuccess: lastSuccess.toISOString(),
  };
}
