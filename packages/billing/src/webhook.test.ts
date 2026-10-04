import { beforeEach, describe, expect, it, vi } from "vitest";

const inserted: unknown[] = [];
const updated: { values: unknown; orgId: string; product: string }[] = [];
let existingRows: { orgId: string; product: string }[] = [];
const syncVigiloPlan = vi.fn(async (_input: { orgId: string; planId: string }) => "synced");

const logEvent = vi.fn(async (_event: Record<string, unknown>) => {});
vi.mock("@nexora/telemetry", () => ({
  logEvent: (event: Record<string, unknown>) => logEvent(event),
}));

vi.mock("./vigilo-sync", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./vigilo-sync")>()),
  syncVigiloPlan: (input: { orgId: string; planId: string }) => syncVigiloPlan(input),
}));

vi.mock("@nexora/database", () => ({
  subscriptions: { orgId: "orgId", product: "product" },
  db: {
    select: () => ({
      from: () => ({
        where: (cond: { orgId?: string; product?: string }) => ({
          limit: () =>
            Promise.resolve(
              existingRows.some((r) => r.orgId === cond.orgId && r.product === cond.product)
                ? [{ id: "existing-row" }]
                : [],
            ),
        }),
      }),
    }),
    update: () => ({
      set: (values: unknown) => ({
        where: (cond: { orgId: string; product: string }) => {
          updated.push({ values, orgId: cond.orgId, product: cond.product });
          return Promise.resolve();
        },
      }),
    }),
    insert: () => ({
      values: (values: unknown) => {
        inserted.push(values);
        return Promise.resolve();
      },
    }),
  },
}));

// eq/and just need to hand the field/value pairs through to the fake `where`
// above, not build real SQL — the mock db never sees a real query.
vi.mock("drizzle-orm", () => ({
  eq: (field: string, value: string) => ({ [field]: value }),
  and: (...conds: Record<string, string>[]) => Object.assign({}, ...conds),
}));

// A small, fixed fake catalog instead of the real env-configured one — the
// real plans.ts reads Stripe price ids from process.env, which isn't set in
// this test environment, so testing against it directly would be fragile.
vi.mock("./plans", () => ({
  PLANS: [
    {
      id: "pro",
      product: "sentinel",
      stripePriceIds: { month: "price_sentinel_pro", year: "price_sentinel_pro_yearly" },
    },
    {
      id: "business",
      product: "cspm",
      stripePriceIds: { month: "price_cspm_business", year: "price_cspm_business_yearly" },
    },
    {
      id: "scale",
      product: "sentinel",
      stripePriceIds: { month: "price_sentinel_scale", year: "price_sentinel_scale_yearly" },
    },
    {
      id: "pro",
      product: "gateway",
      stripePriceIds: { month: "price_gateway_pro", year: "price_gateway_pro_yearly" },
    },
    {
      id: "pro",
      product: "vigilo",
      stripePriceIds: { month: "price_vigilo_pro", year: "price_vigilo_pro_yearly" },
    },
  ],
}));

import { applySubscriptionEvent } from "./webhook";

function fakeSubscriptionEvent(
  type: string,
  orgId: string | undefined,
  items: { priceId: string; currentPeriodEnd?: number }[],
  status = "active",
) {
  return {
    type,
    data: {
      object: {
        id: "sub_test123",
        status,
        customer: "cus_test123",
        metadata: orgId ? { orgId } : {},
        items: {
          data: items.map((item, i) => ({
            price: { id: item.priceId },
            current_period_end: item.currentPeriodEnd ?? 1_700_000_000 + i,
          })),
        },
      },
    },
  } as unknown as Parameters<typeof applySubscriptionEvent>[0];
}

describe("applySubscriptionEvent", () => {
  beforeEach(() => {
    inserted.length = 0;
    updated.length = 0;
    existingRows = [];
    logEvent.mockClear();
    syncVigiloPlan.mockClear();
    syncVigiloPlan.mockImplementation(async () => "synced");
  });

  it("writes one row per item for a multi-product bundle subscription", async () => {
    const event = fakeSubscriptionEvent("customer.subscription.created", "org_bundle", [
      { priceId: "price_sentinel_pro" },
      { priceId: "price_cspm_business" },
    ]);

    await applySubscriptionEvent(event);

    expect(inserted).toHaveLength(2);
    expect(inserted).toContainEqual(
      expect.objectContaining({ orgId: "org_bundle", product: "sentinel", planId: "pro" }),
    );
    expect(inserted).toContainEqual(
      expect.objectContaining({ orgId: "org_bundle", product: "cspm", planId: "business" }),
    );
  });

  it("updates each product's existing row independently rather than inserting", async () => {
    existingRows = [
      { orgId: "org_bundle", product: "sentinel" },
      { orgId: "org_bundle", product: "cspm" },
    ];

    const event = fakeSubscriptionEvent("customer.subscription.updated", "org_bundle", [
      { priceId: "price_sentinel_scale" },
      { priceId: "price_not_a_real_price" }, // an item whose price this account doesn't recognise
    ]);

    await applySubscriptionEvent(event);

    expect(inserted).toHaveLength(0);
    expect(updated).toHaveLength(1);
    expect(updated[0]).toMatchObject({ orgId: "org_bundle", product: "sentinel" });
    expect(updated[0]!.values).toMatchObject({ planId: "scale" });
  });

  it("ignores an event with no orgId (e.g. Vigilo's shared use of the same Stripe account)", async () => {
    const event = fakeSubscriptionEvent("customer.subscription.created", undefined, [
      { priceId: "price_gateway_pro" },
    ]);

    await applySubscriptionEvent(event);

    expect(inserted).toHaveLength(0);
    expect(updated).toHaveLength(0);
  });

  it("does not resurrect a deleted org's row for a product with no existing row", async () => {
    const event = fakeSubscriptionEvent("customer.subscription.deleted", "org_purged", [
      { priceId: "price_gateway_pro" },
    ]);

    await applySubscriptionEvent(event);

    expect(inserted).toHaveLength(0);
  });

  it("ignores a price id that doesn't belong to any billed product", async () => {
    const event = fakeSubscriptionEvent("customer.subscription.created", "org_x", [
      { priceId: "price_unrelated_vigilo_price" },
    ]);

    await applySubscriptionEvent(event);

    expect(inserted).toHaveLength(0);
    expect(updated).toHaveLength(0);
  });

  describe("Vigilo (Core owns the subscription, Vigilo is told the plan)", () => {
    it("records the subscription and syncs Pro while it is active", async () => {
      await applySubscriptionEvent(
        fakeSubscriptionEvent("customer.subscription.created", "org_v", [
          { priceId: "price_vigilo_pro" },
        ]),
      );

      expect(inserted).toContainEqual(
        expect.objectContaining({ orgId: "org_v", product: "vigilo", planId: "pro" }),
      );
      expect(syncVigiloPlan).toHaveBeenCalledExactlyOnceWith({ orgId: "org_v", planId: "pro" });
    });

    it("syncs Free when the subscription stops being active", async () => {
      existingRows = [{ orgId: "org_v", product: "vigilo" }];
      await applySubscriptionEvent(
        fakeSubscriptionEvent(
          "customer.subscription.updated",
          "org_v",
          [{ priceId: "price_vigilo_pro" }],
          "past_due",
        ),
      );
      expect(syncVigiloPlan).toHaveBeenCalledExactlyOnceWith({ orgId: "org_v", planId: "free" });
    });

    it("syncs Free on deletion, without re-inserting a purged organisation", async () => {
      await applySubscriptionEvent(
        fakeSubscriptionEvent("customer.subscription.deleted", "org_purged", [
          { priceId: "price_vigilo_pro" },
        ]),
      );
      expect(inserted).toHaveLength(0);
      expect(syncVigiloPlan).toHaveBeenCalledExactlyOnceWith({
        orgId: "org_purged",
        planId: "free",
      });
    });

    it("leaves an audit event for each completed sync, and none when sync is switched off", async () => {
      await applySubscriptionEvent(
        fakeSubscriptionEvent("customer.subscription.created", "org_v", [
          { priceId: "price_vigilo_pro" },
        ]),
      );
      expect(logEvent).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          orgId: "org_v",
          action: "billing.vigilo_sync.completed",
          outcome: "success",
          metadata: { planId: "pro" },
        }),
      );

      logEvent.mockClear();
      syncVigiloPlan.mockImplementationOnce(async () => "skipped");
      await applySubscriptionEvent(
        fakeSubscriptionEvent("customer.subscription.updated", "org_v", [
          { priceId: "price_vigilo_pro" },
        ]),
      );
      expect(logEvent).not.toHaveBeenCalled();
    });

    it("records a failed sync before failing the webhook", async () => {
      syncVigiloPlan.mockRejectedValueOnce(new Error("Vigilo plan sync failed with HTTP 503"));
      await expect(
        applySubscriptionEvent(
          fakeSubscriptionEvent("customer.subscription.created", "org_v", [
            { priceId: "price_vigilo_pro" },
          ]),
        ),
      ).rejects.toThrow("HTTP 503");
      expect(logEvent).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          outcome: "failure",
          metadata: { planId: "pro", error: "Vigilo plan sync failed with HTTP 503" },
        }),
      );
    });

    it("does not touch Vigilo for any other product", async () => {
      await applySubscriptionEvent(
        fakeSubscriptionEvent("customer.subscription.created", "org_s", [
          { priceId: "price_sentinel_pro" },
        ]),
      );
      expect(syncVigiloPlan).not.toHaveBeenCalled();
    });

    it("fails the webhook if the sync fails, after the subscription is already saved", async () => {
      syncVigiloPlan.mockRejectedValueOnce(new Error("Vigilo down"));
      await expect(
        applySubscriptionEvent(
          fakeSubscriptionEvent("customer.subscription.created", "org_v", [
            { priceId: "price_vigilo_pro" },
          ]),
        ),
      ).rejects.toThrow("Vigilo down");
      expect(inserted).toHaveLength(1);
    });
  });
});
