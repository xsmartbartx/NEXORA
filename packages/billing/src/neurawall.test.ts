import { describe, expect, it } from "vitest";
import { resolveNeurawallEntitlement } from "./neurawall";

const sub = (planId: string, status: string, end: Date | null = null) => ({
  planId,
  status,
  currentPeriodEnd: end,
});

describe("resolveNeurawallEntitlement", () => {
  it("is Community with no subscription row", () => {
    expect(resolveNeurawallEntitlement("org_1", null)).toEqual({
      org_id: "org_1",
      plan_id: "community",
      current_period_end: null,
    });
  });

  it("returns the paid plan and the period end in epoch seconds while active or trialing", () => {
    const end = new Date("2026-11-01T00:00:00Z");
    for (const status of ["active", "trialing"]) {
      expect(resolveNeurawallEntitlement("org_1", sub("business", status, end))).toEqual({
        org_id: "org_1",
        plan_id: "business",
        current_period_end: Math.floor(end.getTime() / 1000),
      });
    }
  });

  it("falls back to Community for any other status, the same rule as Core's own plans", () => {
    for (const status of ["past_due", "canceled", "unpaid", "incomplete", "paused"]) {
      expect(resolveNeurawallEntitlement("org_1", sub("pro", status)).plan_id).toBe("community");
    }
  });

  it("never passes an unknown plan id through, nor Core's own tier names", () => {
    for (const planId of ["scale", "starter", "", "PRO", "pro ", "enterprise_dedicated"]) {
      expect(resolveNeurawallEntitlement("org_1", sub(planId, "active")).plan_id).toBe("community");
    }
  });

  it("is Community, with no period end, when the product is suspended", () => {
    const end = new Date("2026-11-01T00:00:00Z");
    expect(resolveNeurawallEntitlement("org_1", sub("enterprise", "active", end), true)).toEqual({
      org_id: "org_1",
      plan_id: "community",
      current_period_end: null,
    });
  });

  it("treats the catalog's free tier as Community, never as a wire plan of its own", () => {
    expect(resolveNeurawallEntitlement("org_1", sub("free", "active")).plan_id).toBe("community");
  });

  it("keeps a null period end as null", () => {
    expect(
      resolveNeurawallEntitlement("org_1", sub("pro", "active")).current_period_end,
    ).toBeNull();
  });
});
