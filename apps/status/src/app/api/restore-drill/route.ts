import { NextResponse } from "next/server";
import { RESTORE_DRILL_MAX_AGE_MS, readBackupFreshness } from "../backup/freshness";

// The heartbeat changes monthly; never serve a build-time answer.
export const dynamic = "force-dynamic";

/**
 * 200 when the last passing restore drill is recent, 503 otherwise: the uptime
 * workflow probes this, so a failed or missed monthly drill emails the owner.
 * The host's drill cron writes the file only when restore-drill.sh exits 0; it
 * sits in the same bind-mounted directory as the backup heartbeat.
 */
export async function GET() {
  const freshness = await readBackupFreshness(
    process.env.RESTORE_DRILL_HEARTBEAT_FILE ?? "/backup-heartbeat/restore-drill-success",
    Date.now(),
    RESTORE_DRILL_MAX_AGE_MS,
  );
  return NextResponse.json(freshness, { status: freshness.status === "ok" ? 200 : 503 });
}
