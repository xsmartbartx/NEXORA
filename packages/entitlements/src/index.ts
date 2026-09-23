import { getOrgPlan } from "@nexora/billing";
import { countOrgEvents, startOfCurrentBillingPeriod } from "@nexora/telemetry";

export interface EntitlementCheck {
  allowed: boolean;
  reason?: string;
  limit?: number | null;
  used?: number;
}

/**
 * Tenant Contract T-4: "Checks entitlements before any billable or limited
 * action." Real as of Phase 5: reads the organisation's current plan
 * (`@nexora/billing`, fed by Paddle webhooks) and, for metered features,
 * counts this billing period's usage (`@nexora/telemetry`) against the
 * plan's limit for that feature.
 *
 * `feature` is a free-form key per product, e.g. `"sentinel.scan"` or
 * `"cspm.scan"` — namespaced the same way as telemetry events (Appendix A).
 * The corresponding usage event is expected at `${feature}.completed`
 * (e.g. `"sentinel.scan.completed"`) — every product that calls this
 * follows that convention when it logs via `@nexora/telemetry`.
 */
export async function checkEntitlement(orgId: string, feature: string): Promise<EntitlementCheck> {
  const plan = await getOrgPlan(orgId);
  const limit = plan.limits[feature];

  // Not a metered feature on this plan's catalog — nothing to check.
  if (limit === undefined) {
    return { allowed: true };
  }
  // Explicitly unlimited.
  if (limit === null) {
    return { allowed: true, limit: null };
  }

  const used = await countOrgEvents(orgId, `${feature}.completed`, startOfCurrentBillingPeriod());
  if (used >= limit) {
    return {
      allowed: false,
      reason: `Monthly limit reached (${used}/${limit} on the ${plan.name} plan). Upgrade in Console → Billing.`,
      limit,
      used,
    };
  }
  return { allowed: true, limit, used };
}
