import { describe, expect, it } from "vitest";
import {
  bundleDiscountPercent,
  BUNDLE_DISCOUNTS,
  BUNDLE_PRODUCT_IDS,
  EXTERNALLY_ENFORCED_PRODUCT_IDS,
  getPlan,
  getPlansForProduct,
  isBundleProductId,
  isProductId,
  PLAN_CATALOG,
  PLANS,
  PRODUCT_IDS,
} from "./plans";

// The five-tier ladder (and its 20%-off annual rule) describes the three native
// products; Vigilo is a two-plan product with its own tests below.
const NATIVE = BUNDLE_PRODUCT_IDS;

describe("plan catalog", () => {
  it("has five tiers for every product, in ascending price order", () => {
    for (const product of NATIVE) {
      const tiers = getPlansForProduct(product);
      expect(tiers.map((t) => t.id)).toEqual(["free", "starter", "pro", "business", "scale"]);
      const prices = tiers.map((t) => t.priceCents.month);
      expect(prices).toEqual([...prices].sort((a, b) => a - b));
    }
  });

  it("prices every paid tier's annual price at exactly 20% off monthly", () => {
    for (const product of NATIVE) {
      for (const tier of getPlansForProduct(product)) {
        if (tier.priceCents.month === 0) {
          expect(tier.priceCents.year).toBe(0);
          continue;
        }
        const expected = Math.round(tier.priceCents.month * 12 * 0.8);
        expect(tier.priceCents.year).toBe(expected);
      }
    }
  });

  it("increases the metered limit at every tier, never actually unlimited", () => {
    for (const product of NATIVE) {
      const limits = getPlansForProduct(product).map((tier) => Object.values(tier.limits)[0]);
      expect(limits.every((limit) => limit !== null)).toBe(true);
      for (let i = 1; i < limits.length; i++) {
        expect(limits[i]!).toBeGreaterThan(limits[i - 1]!);
      }
    }
  });

  it("scopes each product's limits to its own feature key only", () => {
    for (const product of NATIVE) {
      for (const tier of getPlansForProduct(product)) {
        expect(Object.keys(tier.limits)).toEqual([
          `${product}.${product === "gateway" ? "proxy" : "scan"}`,
        ]);
      }
    }
  });

  it("getPlan falls back to the product's free tier for an unknown tier id", () => {
    const plan = getPlan("sentinel", "nonexistent");
    expect(plan.id).toBe("free");
    expect(plan.product).toBe("sentinel");
  });

  it("keeps every product's free tier at $0 with no Stripe price", () => {
    for (const product of NATIVE) {
      const free = getPlan(product, "free");
      expect(free.priceCents).toEqual({ month: 0, year: 0 });
      expect(free.stripePriceIds).toEqual({ month: null, year: null });
    }
  });

  it("isProductId accepts the four billed products and nothing else", () => {
    for (const id of ["sentinel", "cspm", "gateway", "vigilo"]) expect(isProductId(id)).toBe(true);
    expect(isProductId("neurawall")).toBe(false);
    expect(isProductId("")).toBe(false);
  });

  it("only the three native products can be bundled", () => {
    expect(BUNDLE_PRODUCT_IDS).toEqual(["sentinel", "cspm", "gateway"]);
    expect(isBundleProductId("sentinel")).toBe(true);
    expect(isBundleProductId("vigilo")).toBe(false);
  });

  it("PLAN_CATALOG and PRODUCT_IDS stay in sync", () => {
    expect(Object.keys(PLAN_CATALOG).sort()).toEqual([...PRODUCT_IDS].sort());
  });
});

describe("Vigilo plans", () => {
  it("are Free and Pro only, reusing the prices Vigilo already sells", () => {
    const plans = getPlansForProduct("vigilo");
    expect(plans.map((p) => p.id)).toEqual(["free", "pro"]);
    expect(plans[1]!.priceCents).toEqual({ month: 2900, year: 29000 });
  });

  it("limit Free to 3 scans a month and leave Pro unmetered", () => {
    expect(getPlan("vigilo", "free").limits).toEqual({ "vigilo.scan": 3 });
    expect(getPlan("vigilo", "pro").limits).toEqual({ "vigilo.scan": null });
  });

  it("read the Pro Stripe price ids from STRIPE_PRICE_ID_VIGILO_PRO(_YEARLY)", () => {
    // Env is read when the module loads; an unset price is null, never a guess.
    const { stripePriceIds } = getPlan("vigilo", "pro");
    expect(stripePriceIds.month ?? null).toBe(process.env.STRIPE_PRICE_ID_VIGILO_PRO || null);
    expect(stripePriceIds.year ?? null).toBe(process.env.STRIPE_PRICE_ID_VIGILO_PRO_YEARLY || null);
  });

  it("is enforced by Vigilo itself, so Core does not offer to suspend it", () => {
    expect(EXTERNALLY_ENFORCED_PRODUCT_IDS).toEqual(["vigilo"]);
  });

  it("is part of the flat PLANS view", () => {
    expect(PLANS.filter((p) => p.product === "vigilo")).toHaveLength(2);
  });
});

describe("bundle discount ladder", () => {
  it("defines exactly the 2- and 3-product tiers", () => {
    expect(BUNDLE_DISCOUNTS).toEqual({ 2: 8, 3: 12 });
  });

  it("gives no discount for a single product", () => {
    expect(bundleDiscountPercent(1)).toBe(0);
  });

  it("gives 8% for two products and 12% for three", () => {
    expect(bundleDiscountPercent(2)).toBe(8);
    expect(bundleDiscountPercent(3)).toBe(12);
  });

  it("gives no discount outside the defined range (0, or more than the product count)", () => {
    expect(bundleDiscountPercent(0)).toBe(0);
    expect(bundleDiscountPercent(4)).toBe(0);
  });
});
