import { describe, expect, it } from "vitest";
import { STUCK_AFTER_MINUTES, summarizeDelivery, summarizeEndpoints } from "./webhooks";

describe("summarizeEndpoints", () => {
  it("flags endpoints Stripe has disabled, which silently stop receiving events", () => {
    const summary = summarizeEndpoints([
      {
        id: "we_1",
        url: "https://api.test/v1/webhooks/stripe",
        status: "enabled",
        enabled_events: ["*"],
      },
      { id: "we_2", url: "https://old.test/hook", status: "disabled", enabled_events: ["a", "b"] },
    ]);
    expect(summary.disabled).toBe(1);
    expect(summary.endpoints).toEqual([
      { url: "https://api.test/v1/webhooks/stripe", enabled: true, events: "all" },
      { url: "https://old.test/hook", enabled: false, events: 2 },
    ]);
  });

  it("has no problems with no endpoints", () => {
    expect(summarizeEndpoints([])).toEqual({ endpoints: [], disabled: 0 });
  });
});

const NOW = 1_790_000_000_000;
const ago = (minutes: number) => Math.floor((NOW - minutes * 60_000) / 1000);
const event = (id: string, type: string, minutes: number, pending = 0) => ({
  id,
  type,
  created: ago(minutes),
  pending_webhooks: pending,
});

describe("summarizeDelivery", () => {
  it("counts the last 24 hours and ranks the busiest types", () => {
    const summary = summarizeDelivery(
      [
        event("1", "invoice.paid", 5),
        event("2", "invoice.paid", 30),
        event("3", "customer.subscription.updated", 60),
        event("4", "invoice.paid", 60 * 25), // older than 24h: ignored
      ],
      NOW,
    );
    expect(summary.events24h).toBe(3);
    expect(summary.topTypes).toEqual([
      { type: "invoice.paid", count: 2 },
      { type: "customer.subscription.updated", count: 1 },
    ]);
  });

  it("calls an event stuck only once it has waited past the threshold", () => {
    const summary = summarizeDelivery(
      [
        event("fresh", "invoice.paid", STUCK_AFTER_MINUTES - 1, 1), // still being delivered
        event("late", "invoice.paid", STUCK_AFTER_MINUTES + 5, 1),
        event("done", "invoice.paid", 120, 0), // delivered
      ],
      NOW,
    );
    expect(summary.stuck.map((s) => s.id)).toEqual(["late"]);
    expect(summary.stuck[0]).toMatchObject({ type: "invoice.paid", pendingWebhooks: 1 });
  });

  it("limits the stuck list and notes when a full page may hide more", () => {
    const many = Array.from({ length: 100 }, (_, i) => event(String(i), "x", 30, 1));
    const summary = summarizeDelivery(many, NOW);
    expect(summary.stuck).toHaveLength(10);
    expect(summary.capped).toBe(true);
    expect(summarizeDelivery([event("1", "x", 5)], NOW).capped).toBe(false);
  });
});
