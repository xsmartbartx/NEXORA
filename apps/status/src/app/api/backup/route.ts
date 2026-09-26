import { NextResponse } from "next/server";
import { readBackupFreshness } from "./freshness";

// The heartbeat changes nightly; never serve a build-time answer.
export const dynamic = "force-dynamic";

/**
 * 200 when the last fully successful backup is recent, 503 otherwise —
 * the uptime workflow probes this, so a missed night emails the owner.
 * The file is bind-mounted from the host (see docker-compose.prod.yml).
 */
export async function GET() {
  const freshness = await readBackupFreshness(
    process.env.BACKUP_HEARTBEAT_FILE ?? "/backup-heartbeat/last-success",
  );
  return NextResponse.json(freshness, { status: freshness.status === "ok" ? 200 : 503 });
}
