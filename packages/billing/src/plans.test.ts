import { describe, expect, it } from "vitest";
import {
  bundleDiscountPercent,
  BUNDLE_DISCOUNTS,
  getPlan,
  getPlansForProduct,
  isProductId,
  PLAN_CATALOG,
  PRODUCT_IDS,
} from "./plans";

describe("plan catalog", () => {
  it("has five tiers for every product, in ascending price order", () => {
    for (const product of PRODUCT_IDS) {
      const tiers = getPlansForProduct(product);
      expect(tiers.map((t) => t.id)).toEqual(["free", "starter", "pro", "business", "scale"]);
      const prices = tiers.map((t) => t.priceCents.month);
      expect(prices).toEqual([...prices].sort((a, b) => a - b));
    }
  });

  it("prices every paid tier's annual price at exactly 20% off monthly", () => {
    for (const product of PRODUCT_IDS) {
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
    for (const product of PRODUCT_IDS) {
      const limits = getPlansForProduct(product).map((tier) => Object.values(tier.limits)[0]);
      expect(limits.every((limit) => limit !== null)).toBe(true);
      for (let i = 1; i < limits.length; i++) {
        expect(limits[i]!).toBeGreaterThan(limits[i - 1]!);
      }
    }
  });

  it("scopes each product's limits to its own feature key only", () => {
    for (const product of PRODUCT_IDS) {
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
    for (const product of PRODUCT_IDS) {
      const free = getPlan(product, "free");
      expect(free.priceCents).toEqual({ month: 0, year: 0 });
      expect(free.stripePriceIds).toEqual({ month: null, year: null });
    }
  });

  it("isProductId only accepts the three billed products", () => {
    expect(isProductId("sentinel")).toBe(true);
    expect(isProductId("cspm")).toBe(true);
    expect(isProductId("gateway")).toBe(true);
    expect(isProductId("vigilo")).toBe(false);
    expect(isProductId("")).toBe(false);
  });

  it("PLAN_CATALOG and PRODUCT_IDS stay in sync", () => {
    expect(Object.keys(PLAN_CATALOG).sort()).toEqual([...PRODUCT_IDS].sort());
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
