import { describe, expect, it } from "vitest";
import type { OpsCost } from "@nexora/database";
import { monthlyCost, parseDollarsToCents, summarizeCosts, validateCost } from "./costs";

const cost = (over: Partial<OpsCost>): OpsCost => ({
  id: "id",
  vendor: "Oracle Cloud",
  label: "",
  amountCents: 1000,
  interval: "month",
  createdBy: "user_1",
  createdAt: new Date(),
  endedAt: null,
  ...over,
});

describe("parseDollarsToCents", () => {
  it("parses whole and fractional dollars", () => {
    expect(parseDollarsToCents("12")).toBe(1200);
    expect(parseDollarsToCents("12.5")).toBe(1250);
    expect(parseDollarsToCents("$0.99")).toBe(99);
    expect(parseDollarsToCents(" 1234.56 ")).toBe(123456);
  });

  it("rejects anything ambiguous or non-positive", () => {
    for (const bad of ["", "abc", "-5", "1,000", "12.345", "0", "0.00", "1e3", "12 USD"]) {
      expect(() => parseDollarsToCents(bad), bad).toThrow();
    }
  });
});

describe("validateCost", () => {
  const ok = { vendor: " Oracle ", label: " host ", amountCents: 500, interval: "month" } as const;

  it("trims and accepts a good entry", () => {
    expect(validateCost(ok)).toEqual({
      vendor: "Oracle",
      label: "host",
      amountCents: 500,
      interval: "month",
    });
  });

  it("rejects bad input", () => {
    expect(() => validateCost({ ...ok, vendor: "  " })).toThrow();
    expect(() => validateCost({ ...ok, vendor: "x".repeat(61) })).toThrow();
    expect(() => validateCost({ ...ok, label: "x".repeat(121) })).toThrow();
    expect(() => validateCost({ ...ok, amountCents: 0 })).toThrow();
    expect(() => validateCost({ ...ok, amountCents: 1.5 })).toThrow();
    expect(() => validateCost({ ...ok, interval: "week" as "month" })).toThrow();
  });
});

describe("cost summary", () => {
  it("normalises a yearly cost to a month", () => {
    expect(monthlyCost({ amountCents: 1200, interval: "year" })).toBe(100);
    expect(monthlyCost({ amountCents: 1200, interval: "month" })).toBe(1200);
  });

  it("totals and groups by vendor, biggest first", () => {
    const summary = summarizeCosts([
      cost({ vendor: "Oracle Cloud", amountCents: 4000 }),
      cost({ vendor: "Domains", amountCents: 2400, interval: "year" }),
      cost({ vendor: "Oracle Cloud", amountCents: 1000 }),
    ]);
    expect(summary.monthlyCents).toBe(5200);
    expect(summary.byVendor).toEqual([
      { vendor: "Oracle Cloud", monthlyCents: 5000 },
      { vendor: "Domains", monthlyCents: 200 },
    ]);
  });
});
