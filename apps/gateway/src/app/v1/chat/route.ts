import { NextResponse } from "next/server";
import { apiError, withApiKey } from "@nexora/api-kit";
import { checkEntitlement } from "@nexora/entitlements";
import { logEvent } from "@nexora/telemetry";
import { relayChatRequest, type RelayRequest } from "@/lib/relay";

export async function POST(request: Request) {
  return withApiKey(request, "gateway", async (key) => {
    const entitlement = await checkEntitlement(key.orgId, "gateway.proxy");
    if (!entitlement.allowed) {
      return apiError(
        403,
        "entitlement_exceeded",
        entitlement.reason ?? "Not entitled to use Gateway.",
      );
    }

    let input: RelayRequest;
    try {
      input = await request.json();
    } catch {
      return apiError(400, "invalid_payload", "Request body must be JSON.");
    }
    if (!Array.isArray(input.messages) || input.messages.length === 0) {
      return apiError(400, "invalid_payload", '"messages" must be a non-empty array.');
    }

    const startedAt = Date.now();
    const result = await relayChatRequest(input);

    await logEvent({
      orgId: key.orgId,
      actorId: key.keyId,
      action: "gateway.proxy.completed",
      resourceType: "chat_request",
      outcome: result.ok ? "success" : "failure",
      metadata: { status: result.status, latencyMs: Date.now() - startedAt },
    });

    return NextResponse.json(result.raw, { status: result.status });
  });
}
