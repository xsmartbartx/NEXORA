import { describe, expect, it } from "vitest";
// @ts-expect-error plain ESM module, no type declarations
import { assess, canSpend, monthSpend, parseBudget } from "./budget.mjs";
// @ts-expect-error plain ESM module, no type declarations
import { evaluate, isClean, redact, renderReport } from "./policy.mjs";

const good = () => ({
  defaultBranch: "main",
  securityAndAnalysis: {
    secret_scanning: "enabled",
    secret_scanning_push_protection: "enabled",
    dependabot_security_updates: "enabled",
  },
  protection: {
    protected: true,
    requiredChecks: ["ci"],
    enforceAdmins: true,
    allowForcePushes: false,
    allowDeletions: false,
  },
  workflowDefaultPermissions: "read",
  workflows: [
    { path: ".github/workflows/ci.yml", content: "on: push\npermissions:\n  contents: read\n" },
  ],
  alerts: { dependabotHigh: 0, codeScanningHigh: 0 },
});
const ids = (s: unknown) => (evaluate(s) as { id: string }[]).map((f) => f.id);

describe("policy", () => {
  it("reads the API's { status } shape", () => {
    const s = good() as any;
    s.securityAndAnalysis = {
      secret_scanning: { status: "enabled" },
      secret_scanning_push_protection: { status: "disabled" },
      dependabot_security_updates: { status: "enabled" },
    };
    expect(ids(s)).toEqual(["PUSH-PROTECTION"]);
  });

  it("passes a compliant repository", () => expect(ids(good())).toEqual([]));

  it.each([
    ["unprotected branch", (s: any) => (s.protection = { protected: false }), "BRANCH-PROTECTED"],
    ["no required checks", (s: any) => (s.protection.requiredChecks = []), "BRANCH-CHECKS"],
    ["force pushes", (s: any) => (s.protection.allowForcePushes = true), "BRANCH-FORCE"],
    ["deletions", (s: any) => (s.protection.allowDeletions = true), "BRANCH-DELETE"],
    ["admins exempt", (s: any) => (s.protection.enforceAdmins = false), "BRANCH-ENFORCE-ADMINS"],
    [
      "secret scanning off",
      (s: any) => (s.securityAndAnalysis.secret_scanning = "disabled"),
      "SECRET-SCANNING",
    ],
    [
      "push protection off",
      (s: any) => (s.securityAndAnalysis.secret_scanning_push_protection = "disabled"),
      "PUSH-PROTECTION",
    ],
    [
      "dependabot updates off",
      (s: any) => delete s.securityAndAnalysis.dependabot_security_updates,
      "DEPENDABOT-UPDATES",
    ],
    ["write-by-default", (s: any) => (s.workflowDefaultPermissions = "write"), "WF-DEFAULT-WRITE"],
    [
      "workflow without permissions",
      (s: any) => (s.workflows[0].content = "on: push\n"),
      "WF-NO-PERMISSIONS",
    ],
    [
      "pull_request_target",
      (s: any) => (s.workflows[0].content += "on:\n  pull_request_target:\n"),
      "WF-PR-TARGET",
    ],
    ["dependabot alerts", (s: any) => (s.alerts.dependabotHigh = 2), "ALERTS-DEPENDABOT"],
    ["code scanning alerts", (s: any) => (s.alerts.codeScanningHigh = 1), "ALERTS-CODEQL"],
  ])("flags %s", (_name, mutate, id) => {
    const s = good();
    (mutate as (x: unknown) => void)(s);
    expect(ids(s)).toContain(id);
  });

  it("reports unreadable settings as UNVERIFIED, never as a pass", () => {
    const s = {
      ...good(),
      protection: null,
      securityAndAnalysis: null,
      alerts: { dependabotHigh: null, codeScanningHigh: null },
    };
    expect(ids(s)).toEqual(["UNVERIFIED-ALERTS", "UNVERIFIED-BRANCH", "UNVERIFIED-SECURITY"]);
    expect(isClean(evaluate(s))).toBe(true);
  });

  it("sorts the worst first and calls only high/medium findings unclean", () => {
    const s = good();
    s.protection.enforceAdmins = false;
    s.protection.allowForcePushes = true;
    const found = evaluate(s) as { severity: string }[];
    expect(found[0].severity).toBe("high");
    expect(isClean(found)).toBe(false);
  });

  it("detects the violation in a deliberately broken configuration (acceptance test)", () => {
    const s = good();
    s.protection = { protected: false };
    expect(ids(s)).toEqual(["BRANCH-PROTECTED"]);
  });
});

describe("report", () => {
  it("redacts secret-shaped values from the output", () => {
    const fake = ["nx", "test", "abcdef123456"].join("_");
    const token = ["gh", "p_"].join("") + "A".repeat(30);
    const f = [
      { id: "X", severity: "high", title: `leak ${fake}`, evidence: token, suggestion: "rotate" },
    ];
    const text = renderReport(f, "2026-10-14");
    expect(text).not.toContain(fake);
    expect(text).not.toContain(token);
    expect(text).toContain("[redacted]");
  });

  it("carries the marker so the issue can be found again", () => {
    expect(renderReport([], "2026-10-14")).toContain("<!-- nexora-costsec -->");
  });

  it("redact leaves ordinary text alone", () =>
    expect(redact("branch main is fine")).toBe("branch main is fine"));
});

describe("budget", () => {
  const b = { monthlyLimitUsd: 10, warnRatio: 0.8, killSwitch: false };

  it("ships a 10 USD / 80 % default in budget.json", async () => {
    const raw = (await import("./budget.json")).default;
    expect(parseBudget(raw)).toMatchObject({
      ok: true,
      budget: { monthlyLimitUsd: 10, warnRatio: 0.8 },
    });
  });

  it.each([
    [0, "ok"],
    [7.99, "ok"],
    [8, "warn"],
    [9.99, "warn"],
    [10, "paused"],
    [12, "paused"],
  ])("spent %d USD is %s", (spent, state) => expect(assess(b, spent).state).toBe(state));

  it("the kill switch stops everything whatever was spent", () => {
    expect(assess({ ...b, killSwitch: true }, 0).state).toBe("killed");
    expect(canSpend({ ...b, killSwitch: true }, 0, 0.01)).toBe(false);
  });

  it("refuses a job whose estimate would cross the limit, and any job once paused", () => {
    expect(canSpend(b, 5, 4)).toBe(true);
    expect(canSpend(b, 9, 1.01)).toBe(false);
    expect(canSpend(b, 10, 0)).toBe(false);
    expect(canSpend(b, 1, Number.NaN)).toBe(false);
    expect(canSpend(b, 1, -1)).toBe(false);
  });

  it("fails closed on invalid configuration", () => {
    for (const raw of [
      null,
      {},
      { monthlyLimitUsd: -1, warnRatio: 0.8, killSwitch: false },
      { monthlyLimitUsd: 10, warnRatio: 1, killSwitch: false },
      { monthlyLimitUsd: 10, warnRatio: 0.8, killSwitch: "no" },
    ]) {
      const r = parseBudget(raw);
      expect(r.ok).toBe(false);
      expect(r.budget.killSwitch).toBe(true);
    }
  });

  it("sums only the given month and ignores malformed entries", () => {
    const entries = [
      { ts: "2026-10-01T00:00:00Z", costUsd: 1.5 },
      { ts: "2026-10-31T23:59:59Z", costUsd: 2 },
      { ts: "2026-09-30T23:59:59Z", costUsd: 100 },
      { ts: "2026-10-05T00:00:00Z", costUsd: -5 },
      { ts: "2026-10-06T00:00:00Z", costUsd: "9" },
      { costUsd: 3 },
      null,
    ];
    expect(monthSpend(entries, "2026-10")).toBe(3.5);
  });
});
