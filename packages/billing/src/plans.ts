/**
 * TODO(launch): every number and name in this file is a PLACEHOLDER, not a
 * business decision — pricing, plan names and limits need a real answer
 * from the business, not from me. This file exists so Entitlements has a
 * real plan to check against and Console has a real plan to render, but
 * `priceCents`, `paddlePriceId` and every `limits` value below are
 * illustrative only. Replace them — and create matching prices in the
 * Paddle dashboard — before anyone can actually subscribe.
 *
 * `limits[feature]`: requests allowed per organisation per calendar month.
 * `null` means unlimited. `feature` keys match the telemetry action
 * namespace products already log against (Appendix A: `<domain>.<object>`,
 * e.g. `"sentinel.scan"`), so a plan change here takes effect immediately —
 * no product code changes.
 */
export interface Plan {
  id: string;
  name: string;
  priceCents: number | null;
  /** Paddle price ID for this plan — env-configured since it's created per-environment in the Paddle dashboard. `null` for the free plan (no checkout needed). */
  paddlePriceId: string | null;
  limits: Record<string, number | null>;
}

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    priceCents: 0,
    paddlePriceId: null,
    limits: {
      "sentinel.scan": 20,
      "cspm.scan": 20,
      "gateway.proxy": 100,
    },
  },
  {
    id: "pro",
    name: "Pro",
    priceCents: 2900,
    paddlePriceId: process.env.PADDLE_PRICE_ID_PRO ?? null,
    limits: {
      "sentinel.scan": null,
      "cspm.scan": null,
      "gateway.proxy": 5000,
    },
  },
];

export const DEFAULT_PLAN_ID = "free";

export function getPlan(planId: string): Plan {
  return PLANS.find((p) => p.id === planId) ?? PLANS.find((p) => p.id === DEFAULT_PLAN_ID)!;
}
