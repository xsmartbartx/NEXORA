import { NextResponse } from "next/server";
import { checkBearer, runHubTick } from "@nexora/admin";

// The probes inside the Control Center can take up to ~40 s. (A POST handler is never cached.)
export const maxDuration = 120;

/**
 * The Notification Hub's heartbeat. Something outside the page (a cron on the host) POSTs here
 * every few minutes with `Authorization: Bearer $OPS_HUB_TOKEN`. Without a configured token the
 * route answers 404, so it does not advertise itself; the edge also refuses `/api/internal/*`
 * from the internet (infrastructure/edge/Caddyfile), so only the compose network can reach it.
 * The answer is counts only, never alert text.
 */
export async function POST(request: Request) {
  const auth = checkBearer(request.headers.get("authorization"), process.env.OPS_HUB_TOKEN);
  if (auth === "disabled") return new NextResponse(null, { status: 404 });
  if (auth !== "ok") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await runHubTick());
}
