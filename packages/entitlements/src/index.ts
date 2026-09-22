export interface EntitlementCheck {
  allowed: boolean;
  reason?: string;
}

/**
 * Tenant Contract T-4: "Checks entitlements before any billable or limited
 * action." No plan or billing data exists yet — that's Phase 5 — so every
 * check currently returns `allowed: true`. The check point exists now, at
 * every product's call site, so wiring real plan limits in later is a
 * one-file change here, not a retrofit across every product.
 *
 * `feature` is a free-form key per product, e.g. `"sentinel.scan"` or
 * `"cspm.scan"` — namespaced the same way as telemetry events (Appendix A:
 * `<domain>.<object>.<action>`).
 */
export async function checkEntitlement(orgId: string, feature: string): Promise<EntitlementCheck> {
  void orgId;
  void feature;
  return { allowed: true };
}
