import { describe, expect, it } from "vitest";
import type { CustomerSummary } from "../customers";
import { classifyKeys, quotaPressure } from "./keys";

const NOW = new Date("2026-10-04T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

describe("classifyKeys", () => {
  it("counts active, never-used, stale and recently revoked keys", () => {
    const hygiene = classifyKeys(
      [
        { orgId: "a", createdAt: daysAgo(40), lastUsedAt: daysAgo(1), revokedAt: null },
        { orgId: "a", createdAt: daysAgo(40), lastUsedAt: daysAgo(45), revokedAt: null },
        { orgId: "b", createdAt: daysAgo(20), lastUsedAt: null, revokedAt: null },
        { orgId: "b", createdAt: daysAgo(2), lastUsedAt: null, revokedAt: null },
        { orgId: "b", createdAt: daysAgo(90), lastUsedAt: daysAgo(80), revokedAt: daysAgo(5) },
        { orgId: "c", createdAt: daysAgo(90), lastUsedAt: null, revokedAt: daysAgo(60) },
      ],
      NOW,
    );
    expect(hygiene).toMatchObject({
      active: 4,
      neverUsed: 1,
      stale: 1,
      revokedLast30Days: 1,
      organisations: 2,
    });
  });

  it("ranks the organisations holding the most active keys", () => {
    const keys = ["a", "b", "b", "b", "c", "c"].map((orgId) => ({
      orgId,
      createdAt: daysAgo(1),
      lastUsedAt: daysAgo(1),
      revokedAt: null,
    }));
    expect(classifyKeys(keys, NOW).topOrgs).toEqual([
      { orgId: "b", active: 3 },
      { orgId: "c", active: 2 },
      { orgId: "a", active: 1 },
    ]);
  });
});

function customer(
  name: string,
  products: { used: number; limit: number | null; suspended?: boolean; plan?: string }[],
): CustomerSummary {
  return {
    orgId: `org_${name}`,
    name,
    slug: name,
    imageUrl: "",
    membersCount: 1,
    createdAt: NOW,
    products: products.map((p, i) => ({
      product: { slug: `p${i}`, name: `Product ${i}`, features: [], registryEntry: undefined },
      plan: { name: p.plan ?? "Pro" } as never,
      subscription: null,
      used: p.used,
      limit: p.limit,
      suspended: p.suspended ?? false,
    })),
  };
}

describe("quotaPressure", () => {
  it("lists usage at or above the threshold, fullest first", () => {
    const rows = quotaPressure([
      customer("low", [{ used: 10, limit: 100 }]),
      customer("edge", [{ used: 80, limit: 100 }]),
      customer("over", [{ used: 120, limit: 100 }]),
    ]);
    expect(rows.map((r) => [r.orgName, Math.round(r.ratio * 100)])).toEqual([
      ["over", 120],
      ["edge", 80],
    ]);
  });

  it("ignores unlimited plans, zero limits and suspended products", () => {
    expect(
      quotaPressure([
        customer("unlimited", [{ used: 1_000_000, limit: null }]),
        customer("zero", [{ used: 5, limit: 0 }]),
        customer("suspended", [{ used: 99, limit: 100, suspended: true }]),
      ]),
    ).toEqual([]);
  });
});
