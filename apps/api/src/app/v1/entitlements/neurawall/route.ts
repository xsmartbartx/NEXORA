import { NextResponse } from "next/server";
import { apiError, NEURAWALL_LINK_SCOPE, requireScope, withApiKey } from "@nexora/api-kit";
import { getNeurawallEntitlement } from "@nexora/billing";

/**
 * C-ENT for NeuraWall, which is hosted by its customers and therefore cannot
 * be called back: it pulls its organisation's plan with an API key carrying
 * the `neurawall:link` scope. The organisation comes from the key, never from
 * the request, so a key can only ever read its own organisation's plan.
 */
export async function GET(request: Request) {
  return withApiKey(request, "neurawall", async (key) => {
    const denied = requireScope(key, NEURAWALL_LINK_SCOPE);
    if (denied) return denied;
    try {
      const entitlement = await getNeurawallEntitlement(key.orgId);
      return NextResponse.json(entitlement, { headers: { "Cache-Control": "no-store" } });
    } catch {
      return apiError(503, "entitlement_unavailable", "The plan could not be read. Retry later.");
    }
  });
}
