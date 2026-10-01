import type { ProductPlan } from "../types";

/**
 * Display-only price reference per product, for surfaces that want to show
 * "from $X/mo" without importing `@nexora/billing` (registry has no
 * dependency on billing — `price_reference` is a human string, not a cent
 * value, precisely so it can't silently drift into double-counting as a
 * second source of billing truth). Kept in sync by hand with
 * `packages/billing/src/plans.ts`'s Free/Starter tier prices; the actual
 * checkout, entitlements and Stripe price IDs all still come from
 * `@nexora/billing` alone.
 *
 * Vigilo and NeuraWall are independently hosted and not yet on Core
 * billing (per their `products.ts` descriptions), so they have no plan
 * records here.
 */
export const productPlans: ProductPlan[] = [
  { product: "sentinel", name: "Free", limits: "20 scans/mo", price_reference: "$0" },
  { product: "sentinel", name: "Starter", limits: "150 scans/mo", price_reference: "From $9/mo" },

  { product: "cspm", name: "Free", limits: "10 scans/mo", price_reference: "$0" },
  { product: "cspm", name: "Starter", limits: "75 scans/mo", price_reference: "From $19/mo" },

  { product: "gateway", name: "Free", limits: "100 calls/mo", price_reference: "$0" },
  { product: "gateway", name: "Starter", limits: "1,500 calls/mo", price_reference: "From $19/mo" },
];
