import { NextResponse } from "next/server";
import { checkBearer, receiveHubEvents } from "@nexora/admin";

const MAX_BODY_BYTES = 64 * 1024;

/**
 * Receives alerts pushed by something else: a Grafana webhook contact point, or any script that
 * POSTs `{ source, title, severity?, detail?, status? }`. Same bearer token and the same
 * invisibility rules as the tick route.
 */
export async function POST(request: Request) {
  const auth = checkBearer(request.headers.get("authorization"), process.env.OPS_HUB_TOKEN);
  if (auth === "disabled") return new NextResponse(null, { status: 404 });
  if (auth !== "ok") return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "payload too large" }, { status: 413 });
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const summary = await receiveHubEvents(body);
  if (!summary) return NextResponse.json({ error: "unrecognised event" }, { status: 422 });
  return NextResponse.json(summary);
}
