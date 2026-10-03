import { describe, expect, it } from "vitest";
import { attentionItems } from "./attention";
import type { ControlCenterSnapshot } from "./index";

const ok = <T>(data: T) => ({ state: "ok", data }) as const;
const notConnected = { state: "not-connected", what: "x", setup: "y" } as const;
const broken = { state: "error", message: "boom" } as const;

const endpoint = (name: string, status: "up" | "degraded" | "down") => ({
  name,
  url: `https://${name}.test`,
  category: "platform" as const,
  status,
  httpStatus: status === "down" ? null : 200,
  latencyMs: status === "down" ? null : 100,
});

const healthy = (): ControlCenterSnapshot => ({
  collectedAt: new Date(),
  health: {
    endpoints: ok([endpoint("Website", "up")]),
    backup: ok({ status: "ok", lastSuccess: null }),
    database: ok({ latencyMs: 3 }),
    infra: ok({
      targetsDown: [],
      postgresUp: true,
      redisUp: true,
      cpuPercent: 10,
      memoryPercent: 40,
      diskFreePercent: 60,
      redisMemoryPercent: 5,
      postgresConnections: 4,
    }),
  },
  application: {
    latency: ok({ sampled: 1, averageMs: 100, slowest: [] }),
    sentry: notConnected,
    ci: ok([
      {
        repo: "xsmartbartx/NEXORA",
        workflows: [
          {
            name: "CI",
            conclusion: "success",
            status: "completed",
            url: "",
            updatedAt: "",
            commit: "",
          },
        ],
      },
    ]),
  },
  security: {
    codeSecurity: ok({
      totals: { critical: 0, high: 0, medium: 2, low: 1 },
      secrets: 0,
      repos: [],
    }),
    certificates: ok([{ host: "onenexora.com", daysLeft: 60 }]),
    access: ok({ suspendedProducts: 0, failedEvents7d: 0, recentAdminActions: [] }),
  },
  business: {
    visitors: notConnected,
    clerk: ok({ users: 1, organizations: 1, newUsers7d: 0, newUsers30d: 1, newUsersCapped: false }),
    activation: ok({ orgsWithKeys: 0, activatedOrgs: 0, activeLast7d: 0, activeKeys: 0 }),
    revenue: ok({
      activeSubscriptions: 0,
      payingCustomers: 0,
      mrrCents: 0,
      arrCents: 0,
      pastDue: 0,
      discountsIgnored: 0,
      nonUsdSkipped: 0,
    }),
  },
  costs: ok({ entries: [], monthlyCents: 0, byVendor: [] }),
  checklist: ok([]),
});

describe("attentionItems", () => {
  it("has nothing to say when everything is fine, and not-connected tiles aren't issues", () => {
    expect(attentionItems(healthy())).toEqual([]);
  });

  it("flags a down endpoint as critical and a slow one as a warning", () => {
    const s = healthy();
    s.health.endpoints = ok([endpoint("API", "down"), endpoint("Docs", "degraded")]);
    expect(attentionItems(s)).toEqual([
      { level: "critical", text: "API is down." },
      { level: "warning", text: "Docs is responding slowly." },
    ]);
  });

  it("flags a stale backup and an unreachable database as critical", () => {
    const s = healthy();
    s.health.backup = ok({ status: "stale", lastSuccess: "2026-01-01T00:00:00Z" });
    s.health.database = broken;
    const texts = attentionItems(s).map((i) => i.text);
    expect(texts).toContain("The nightly backup is stale.");
    expect(texts).toContain("The Console can't reach Postgres.");
  });

  it("flags a full disk, a downed exporter target and a dead Redis", () => {
    const s = healthy();
    s.health.infra = ok({
      targetsDown: ["redis"],
      postgresUp: true,
      redisUp: false,
      cpuPercent: 95,
      memoryPercent: 40,
      diskFreePercent: 5,
      redisMemoryPercent: 5,
      postgresConnections: 4,
    });
    const items = attentionItems(s);
    expect(items.filter((i) => i.level === "critical").map((i) => i.text)).toEqual([
      "Redis exporter reports Redis down.",
      "Root disk is 95% full.",
    ]);
    expect(items.map((i) => i.text)).toContain("CPU is above 90%.");
    expect(items.map((i) => i.text)).toContain("Prometheus can't scrape redis.");
  });

  it("grades certificate expiry", () => {
    const s = healthy();
    s.security.certificates = ok([
      { host: "a.test", daysLeft: 3 },
      { host: "b.test", daysLeft: 15 },
      { host: "c.test", daysLeft: 25 },
      { host: "d.test", daysLeft: null },
    ]);
    const items = attentionItems(s);
    expect(items).toContainEqual({
      level: "critical",
      text: "a.test's certificate expires in 3 days.",
    });
    expect(items).toContainEqual({
      level: "warning",
      text: "b.test's certificate expires in 15 days.",
    });
    expect(items).toContainEqual({
      level: "warning",
      text: "Couldn't check the certificate for d.test.",
    });
    expect(items.some((i) => i.text.includes("c.test"))).toBe(false);
  });

  it("flags failing CI, security alerts, past-due subscriptions and overdue reviews", () => {
    const s = healthy();
    s.application.ci = ok([
      {
        repo: "xsmartbartx/Vigilo",
        workflows: [
          {
            name: "CI",
            conclusion: "failure",
            status: "completed",
            url: "",
            updatedAt: "",
            commit: "",
          },
        ],
      },
    ]);
    s.security.codeSecurity = ok({
      totals: { critical: 1, high: 2, medium: 0, low: 0 },
      secrets: 1,
      repos: [],
    });
    s.business.revenue = ok({
      activeSubscriptions: 1,
      payingCustomers: 1,
      mrrCents: 100,
      arrCents: 1200,
      pastDue: 2,
      discountsIgnored: 0,
      nonUsdSkipped: 0,
    });
    s.checklist = ok([
      {
        id: "x",
        cadence: "daily",
        title: "t",
        detail: "d",
        href: "https://x",
        lastDone: null,
        state: "overdue",
      },
    ]);
    const texts = attentionItems(s).map((i) => i.text);
    expect(texts).toContain("Vigilo: CI is failing on main.");
    expect(texts).toContain("1 critical security alert(s) open.");
    expect(texts).toContain("1 leaked-secret alert(s) open.");
    expect(texts).toContain("2 high-severity security alert(s) open.");
    expect(texts).toContain("2 subscription(s) are past due.");
    expect(texts).toContain("1 owner review(s) are overdue.");
  });

  it("surfaces a configured source that failed to load, but orders critical first", () => {
    const s = healthy();
    s.application.sentry = broken;
    s.health.endpoints = ok([endpoint("Website", "down")]);
    const items = attentionItems(s);
    expect(items[0]).toEqual({ level: "critical", text: "Website is down." });
    expect(items).toContainEqual({ level: "warning", text: "Sentry couldn't be loaded." });
  });
});
