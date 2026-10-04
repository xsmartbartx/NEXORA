/**
 * The plan catalog: Sentinel, CSPM and Gateway are each billed and tiered
 * independently — five tiers per product (Free/Starter/Pro/Business/Scale)
 * — rather than one combined "NEXORA Pro" covering all three at a single
 * price. An organisation can be on a different tier of each product at
 * once; `subscriptions` (packages/database) has one row per
 * (orgId, product), not one per orgId.
 *
 * Design principles behind the tiers and limits (not just arbitrary
 * numbers):
 * - Every paid tier is a real, generous-but-finite quota, never literal
 *   "unlimited" — a flat monthly price against unbounded usage is the
 *   fastest way to lose money on the customers who use the product most.
 * - Starter exists specifically to remove the $0 → $29-ish cliff: a
 *   customer who outgrows Free but doesn't yet need Pro's full quota has
 *   somewhere to land instead of churning at the price jump.
 * - Scale is priced and sized to capture the customer who would otherwise
 *   need a custom/Enterprise conversation — a real self-serve SKU instead
 *   of a slow sales cycle, at a price where margin stays very healthy even
 *   under heavy use.
 * - Annual price is always exactly 20% off monthly (`yearlyPrice`) — one
 *   formula, not five hand-picked numbers that can drift out of sync.
 *
 * Stripe price IDs are env-configured (`STRIPE_PRICE_ID_<PRODUCT>_<TIER>`,
 * `..._YEARLY` for the annual price) because they differ per Stripe account
 * and mode (test vs live).
 */
export type BillingInterval = "month" | "year";
export type NativeProductId = "sentinel" | "cspm" | "gateway";
export type ProductId = NativeProductId | "vigilo";
export type PlanTier = "free" | "starter" | "pro" | "business" | "scale";

export interface Plan {
  id: PlanTier;
  product: ProductId;
  name: string;
  /** Price per billing interval, in US cents. */
  priceCents: Record<BillingInterval, number>;
  /** Stripe price ID per interval — `null` for the free plan or an interval that isn't configured. */
  stripePriceIds: Record<BillingInterval, string | null>;
  limits: Record<string, number | null>;
}

/** Annual price is always monthly × 12 × 0.8 (20% off), rounded to the cent. */
function yearlyPrice(monthlyCents: number): number {
  return Math.round(monthlyCents * 12 * 0.8);
}

function stripeEnvIds(envKey: string): Record<BillingInterval, string | null> {
  return {
    month: process.env[`STRIPE_PRICE_ID_${envKey}`] || null,
    year: process.env[`STRIPE_PRICE_ID_${envKey}_YEARLY`] || null,
  };
}

function tier(
  product: ProductId,
  id: PlanTier,
  name: string,
  monthlyCents: number,
  envKey: string | null,
  limits: Record<string, number | null>,
  /** Only for a price that already exists in Stripe with its own annual amount (Vigilo Pro); otherwise annual is always `yearlyPrice`. */
  yearlyCentsOverride?: number,
): Plan {
  return {
    id,
    product,
    name,
    priceCents: {
      month: monthlyCents,
      year: monthlyCents === 0 ? 0 : (yearlyCentsOverride ?? yearlyPrice(monthlyCents)),
    },
    stripePriceIds: envKey ? stripeEnvIds(envKey) : { month: null, year: null },
    limits,
  };
}

const sentinelPlans: Plan[] = [
  tier("sentinel", "free", "Free", 0, null, { "sentinel.scan": 20 }),
  tier("sentinel", "starter", "Starter", 900, "SENTINEL_STARTER", { "sentinel.scan": 150 }),
  tier("sentinel", "pro", "Pro", 2900, "SENTINEL_PRO", { "sentinel.scan": 1500 }),
  tier("sentinel", "business", "Business", 7900, "SENTINEL_BUSINESS", { "sentinel.scan": 7500 }),
  tier("sentinel", "scale", "Scale", 24900, "SENTINEL_SCALE", { "sentinel.scan": 40000 }),
];

const cspmPlans: Plan[] = [
  tier("cspm", "free", "Free", 0, null, { "cspm.scan": 10 }),
  tier("cspm", "starter", "Starter", 1900, "CSPM_STARTER", { "cspm.scan": 75 }),
  tier("cspm", "pro", "Pro", 4900, "CSPM_PRO", { "cspm.scan": 750 }),
  tier("cspm", "business", "Business", 14900, "CSPM_BUSINESS", { "cspm.scan": 3500 }),
  tier("cspm", "scale", "Scale", 39900, "CSPM_SCALE", { "cspm.scan": 20000 }),
];

const gatewayPlans: Plan[] = [
  tier("gateway", "free", "Free", 0, null, { "gateway.proxy": 100 }),
  tier("gateway", "starter", "Starter", 1900, "GATEWAY_STARTER", { "gateway.proxy": 1500 }),
  tier("gateway", "pro", "Pro", 5900, "GATEWAY_PRO", { "gateway.proxy": 12000 }),
  tier("gateway", "business", "Business", 19900, "GATEWAY_BUSINESS", { "gateway.proxy": 60000 }),
  tier("gateway", "scale", "Scale", 59900, "GATEWAY_SCALE", { "gateway.proxy": 300000 }),
];

/**
 * Vigilo is a two-plan product (Free and one Pro), not the five-tier ladder
 * above, and it reuses the Stripe prices Vigilo already sells: $29/month and
 * $290/year (not the 20%-off formula, which would not match the price that
 * actually exists). Access enforcement stays inside Vigilo; Core owns the
 * subscription and tells Vigilo the resulting plan (see `vigilo-sync.ts`).
 */
const vigiloPlans: Plan[] = [
  tier("vigilo", "free", "Free", 0, null, { "vigilo.scan": 3 }),
  tier("vigilo", "pro", "Pro", 2900, "VIGILO_PRO", { "vigilo.scan": null }, 29000),
];

export const PRODUCT_IDS: ProductId[] = ["sentinel", "cspm", "gateway", "vigilo"];

/** Products that can be combined in a bundle checkout (the three native, five-tier products). */
export const BUNDLE_PRODUCT_IDS: NativeProductId[] = ["sentinel", "cspm", "gateway"];

/** Products whose access Vigilo-style external services enforce themselves: Core records the subscription, but suspending one here would not block anything. */
export const EXTERNALLY_ENFORCED_PRODUCT_IDS: ProductId[] = ["vigilo"];

export const PLAN_CATALOG: Record<ProductId, Plan[]> = {
  sentinel: sentinelPlans,
  cspm: cspmPlans,
  gateway: gatewayPlans,
  vigilo: vigiloPlans,
};

/** Flat view across every product's tiers — for callers that don't care which product a plan belongs to (e.g. admin's product-suspension list). */
export const PLANS: Plan[] = [...sentinelPlans, ...cspmPlans, ...gatewayPlans, ...vigiloPlans];

export const DEFAULT_TIER: PlanTier = "free";

export function getPlansForProduct(product: ProductId): Plan[] {
  return PLAN_CATALOG[product];
}

export function getPlan(product: ProductId, tierId: string): Plan {
  return (
    PLAN_CATALOG[product].find((p) => p.id === tierId) ??
    PLAN_CATALOG[product].find((p) => p.id === DEFAULT_TIER)!
  );
}

export function isProductId(value: string): value is ProductId {
  return (PRODUCT_IDS as string[]).includes(value);
}

export function isBundleProductId(value: string): value is NativeProductId {
  return (BUNDLE_PRODUCT_IDS as string[]).includes(value);
}

/**
 * The bundle discount ladder (percent off): checking out for 2 products at
 * once saves 8%, 3 products saves 12%. Deliberately shallow — the bundle's
 * value is convenience and cross-sell, not a race to the bottom on margin,
 * so this stays well short of stacking with the existing 20%-off-annual
 * discount into something that guts a single product's own price.
 */
export const BUNDLE_DISCOUNTS: Record<number, number> = { 2: 8, 3: 12 };

/** 0 for a single product (no bundle), else the ladder above. */
export function bundleDiscountPercent(productCount: number): number {
  return BUNDLE_DISCOUNTS[productCount] ?? 0;
}
