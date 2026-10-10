import { NextResponse } from "next/server";
import { apiError, NEURAWALL_LINK_SCOPE, requireScope, withApiKey } from "@nexora/api-kit";
import { ingestNeurawallEvents, MAX_BODY_BYTES, parseNeurawallEvents } from "@nexora/telemetry";

/**
 * C-EVENT for NeuraWall: usage events from an installation, written to the
 * organisation's audit trail so they show in Console's Usage feed. Idempotent
 * on `event_id`: a retry after a timeout is stored once. The body is a closed
 * contract (see `@nexora/telemetry`): unknown types or fields are rejected.
 */
export async function POST(request: Request) {
  return withApiKey(request, "neurawall", async (key) => {
    const denied = requireScope(key, NEURAWALL_LINK_SCOPE);
    if (denied) return denied;

    const declared = Number(request.headers.get("content-length") ?? 0);
    if (declared > MAX_BODY_BYTES) {
      return apiError(413, "payload_too_large", `The body may be at most ${MAX_BODY_BYTES} bytes.`);
    }
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) {
      return apiError(413, "payload_too_large", `The body may be at most ${MAX_BODY_BYTES} bytes.`);
    }

    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return apiError(400, "invalid_json", "The body is not valid JSON.");
    }
    const parsed = parseNeurawallEvents(body);
    if (!parsed.ok) return apiError(422, "invalid_events", parsed.message);

    try {
      const result = await ingestNeurawallEvents(key.orgId, key.keyId, parsed.events);
      return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
    } catch {
      return apiError(503, "events_unavailable", "The events could not be stored. Retry later.");
    }
  });
}
