/**
 * The plan catalog: Free, and Pro at $29/month or $290/year (two months
 * free). Stripe price IDs are env-configured because they differ per Stripe
 * account and mode (test vs live) — create them under one "NEXORA Pro"
 * product, one monthly and one yearly recurring price.
 *
 * `limits[feature]`: requests allowed per organisation per calendar month.
 * `null` means unlimited. `feature` keys match the telemetry action
 * namespace products already log against (Appendix A: `<domain>.<object>`,
 * e.g. `"sentinel.scan"`), so a plan change here takes effect immediately —
 * no product code changes.
 */
export type BillingInterval = "month" | "year";

export interface Plan {
  id: string;
  name: string;
  /** Price per billing interval, in US cents. */
  priceCents: Record<BillingInterval, number>;
  /** Stripe price ID per interval — env-configured since prices are created per Stripe account and mode. `null` for the free plan (no checkout needed) or an interval that isn't configured. */
  stripePriceIds: Record<BillingInterval, string | null>;
  limits: Record<string, number | null>;
}

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    priceCents: { month: 0, year: 0 },
    stripePriceIds: { month: null, year: null },
    limits: {
      "sentinel.scan": 20,
      "cspm.scan": 20,
      "gateway.proxy": 100,
    },
  },
  {
    id: "pro",
    name: "Pro",
    priceCents: { month: 2900, year: 29000 },
    stripePriceIds: {
      month: process.env.STRIPE_PRICE_ID_PRO || null,
      year: process.env.STRIPE_PRICE_ID_PRO_YEARLY || null,
    },
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
