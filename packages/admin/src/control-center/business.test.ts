import { describe, expect, it } from "vitest";
import {
  countRecent,
  discountMultiplier,
  monthlyCents,
  summarizeSubscriptions,
  type SubscriptionLike,
} from "./business";

const sub = (
  amount: number,
  interval: string,
  extra: Partial<SubscriptionLike> & { quantity?: number; currency?: string } = {},
): SubscriptionLike => ({
  customer: extra.customer ?? "cus_1",
  discounts: extra.discounts,
  items: {
    data: [
      {
        quantity: extra.quantity ?? 1,
        price: {
          currency: extra.currency ?? "usd",
          unit_amount: amount,
          recurring: { interval, interval_count: 1 },
        },
      },
    ],
  },
});

describe("monthlyCents", () => {
  it("leaves a monthly price alone and spreads a yearly one over 12 months", () => {
    expect(monthlyCents(2900, "month", 1, 1)).toBe(2900);
    expect(monthlyCents(27840, "year", 1, 1)).toBe(2320);
  });

  it("honours interval_count and quantity", () => {
    expect(monthlyCents(3000, "month", 3, 1)).toBe(1000); // every 3 months
    expect(monthlyCents(1000, "month", 1, 4)).toBe(4000); // 4 seats
  });

  it("refuses an interval it doesn't understand instead of guessing", () => {
    expect(() => monthlyCents(1000, "fortnight", 1, 1)).toThrow();
  });
});

describe("discountMultiplier", () => {
  it("applies percentage coupons, in either Stripe API shape", () => {
    expect(discountMultiplier([{ coupon: { percent_off: 8 } }]).multiplier).toBeCloseTo(0.92);
    expect(
      discountMultiplier([{ source: { coupon: { percent_off: 12 } } }]).multiplier,
    ).toBeCloseTo(0.88);
  });

  it("reports discounts it can't apply rather than silently ignoring them", () => {
    expect(discountMultiplier([{ coupon: { amount_off: 500 } }])).toEqual({
      multiplier: 1,
      ignored: 1,
    });
    expect(discountMultiplier(["di_unexpanded"]).ignored).toBe(1);
  });

  it("is a no-op with no discounts", () => {
    expect(discountMultiplier(undefined)).toEqual({ multiplier: 1, ignored: 0 });
  });
});

describe("summarizeSubscriptions", () => {
  it("sums monthly and yearly subscriptions into MRR and ARR", () => {
    const summary = summarizeSubscriptions(
      [sub(2900, "month", { customer: "cus_a" }), sub(27840, "year", { customer: "cus_b" })],
      0,
    );
    expect(summary).toMatchObject({
      activeSubscriptions: 2,
      payingCustomers: 2,
      mrrCents: 5220,
      arrCents: 62640,
    });
  });

  it("applies a bundle discount", () => {
    const summary = summarizeSubscriptions(
      [sub(10000, "month", { discounts: [{ coupon: { percent_off: 12 } }] })],
      0,
    );
    expect(summary.mrrCents).toBe(8800);
  });

  it("counts a customer once even with several subscriptions", () => {
    const summary = summarizeSubscriptions(
      [sub(1000, "month", { customer: "cus_a" }), sub(1000, "month", { customer: "cus_a" })],
      0,
    );
    expect(summary.payingCustomers).toBe(1);
    expect(summary.mrrCents).toBe(2000);
  });

  it("leaves non-USD subscriptions out of MRR and says so", () => {
    const summary = summarizeSubscriptions([sub(5000, "month", { currency: "eur" })], 0);
    expect(summary).toMatchObject({ mrrCents: 0, nonUsdSkipped: 1, payingCustomers: 0 });
  });

  it("carries the past-due count and ignored-discount count through", () => {
    const summary = summarizeSubscriptions(
      [sub(1000, "month", { discounts: [{ coupon: { amount_off: 100 } }] })],
      3,
    );
    expect(summary).toMatchObject({ pastDue: 3, discountsIgnored: 1 });
  });

  it("is all zeros with no subscriptions", () => {
    expect(summarizeSubscriptions([], 0)).toMatchObject({
      mrrCents: 0,
      arrCents: 0,
      payingCustomers: 0,
    });
  });
});

describe("countRecent", () => {
  const now = Date.parse("2026-10-30T00:00:00Z");
  const daysAgo = (n: number) => now - n * 86_400_000;

  it("buckets by age", () => {
    const result = countRecent([daysAgo(1), daysAgo(6), daysAgo(20), daysAgo(90)], now);
    expect(result).toMatchObject({ newUsers7d: 2, newUsers30d: 3, newUsersCapped: false });
  });

  it("flags a full page that's entirely inside the window as a lower bound", () => {
    const page = Array.from({ length: 100 }, () => daysAgo(2));
    expect(countRecent(page, now).newUsersCapped).toBe(true);
  });
});
