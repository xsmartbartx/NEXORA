import { describe, expect, it } from "vitest";
// @ts-expect-error plain ESM module, no type declarations
import { assess, canSpend, monthSpend, parseBudget } from "./budget.mjs";
// @ts-expect-error plain ESM module, no type declarations
import { evaluate, isClean, mergeProtection, redact, renderReport } from "./policy.mjs";

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

  it("reports unreadable settings as UNVERIFIED and keeps the issue open", () => {
    const s = {
      ...good(),
      protection: null,
      securityAndAnalysis: null,
      alerts: { dependabotHigh: null, codeScanningHigh: null },
    };
    expect(ids(s)).toEqual(["UNVERIFIED-ALERTS", "UNVERIFIED-BRANCH", "UNVERIFIED-SECURITY"]);
    expect(isClean(evaluate(s))).toBe(false);
  });

  it.each([
    ["inline scalar", "on: pull_request_target\njobs: {}\n"],
    ["inline list", "on: [push, pull_request_target]\n"],
    ["nested mapping", "on:\n  pull_request_target:\n    types: [opened]\n"],
    ["nested list", "on:\n  - push\n  - pull_request_target\n"],
  ])("finds pull_request_target in the trigger (%s)", (_n, yaml) => {
    const s = good();
    s.workflows = [{ path: "w.yml", content: `permissions: {}\n${yaml}` }];
    expect(ids(s)).toContain("WF-PR-TARGET");
  });

  it("ignores pull_request_target outside the trigger (comment, job name, step)", () => {
    const s = good();
    s.workflows = [
      {
        path: "w.yml",
        content:
          "permissions: {}\n# never use pull_request_target\non: push\njobs:\n  pull_request_target:\n    runs-on: x\n",
      },
    ];
    expect(ids(s)).toEqual([]);
  });

  it("does not call an audit clean when it could not read the workflows or their defaults", () => {
    const s: any = good();
    s.workflows = null;
    s.workflowDefaultPermissions = null;
    const found = evaluate(s);
    expect(ids(s)).toEqual(["UNVERIFIED-WORKFLOW-PERMISSIONS", "UNVERIFIED-WORKFLOWS"]);
    expect(isClean(found)).toBe(false);
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

describe("mergeProtection", () => {
  const branch = { protected: false, protection: { required_status_checks: { contexts: [] } } };

  it("counts rulesets: a 404 from classic protection does not mean unprotected", () => {
    const m = mergeProtection(branch, null, [
      {
        type: "required_status_checks",
        parameters: { required_status_checks: [{ context: "ci" }] },
      },
      { type: "non_fast_forward" },
      { type: "deletion" },
    ]);
    expect(m).toMatchObject({
      protected: true,
      requiredChecks: ["ci"],
      allowForcePushes: false,
      allowDeletions: false,
      enforceAdmins: null,
    });
  });

  it("merges classic checks with ruleset checks without duplicates", () => {
    const classicBranch = {
      protected: true,
      protection: { required_status_checks: { contexts: ["ci"] } },
    };
    const m = mergeProtection(classicBranch, { enforce_admins: { enabled: true } }, [
      {
        type: "required_status_checks",
        parameters: { required_status_checks: [{ context: "ci" }, { context: "sonar" }] },
      },
    ]);
    expect(m.requiredChecks).toEqual(["ci", "sonar"]);
    expect(m.enforceAdmins).toBe(true);
  });

  it("is unprotected with neither mechanism, and null when the branch is unreadable", () => {
    expect(mergeProtection(branch, null, [])).toMatchObject({ protected: false });
    expect(mergeProtection(null, null, [])).toBeNull();
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

  it("assigns an entry to its UTC month whatever offset it is written in", () => {
    const entries = [
      { ts: "2026-09-30T23:30:00-01:00", costUsd: 2 }, // = 2026-10-01T00:30Z
      { ts: "2026-10-01T00:30:00+02:00", costUsd: 5 }, // = 2026-09-30T22:30Z
    ];
    expect(monthSpend(entries, "2026-10")).toBe(2);
    expect(monthSpend(entries, "2026-09")).toBe(5);
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
