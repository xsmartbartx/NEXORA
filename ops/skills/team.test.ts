import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
// @ts-expect-error plain ESM module, no type declarations
import { validateCtoCard, validateReviewReport, validateTeamPlan } from "./lib-team.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));

const task = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  prompt: `do ${id}`,
  scope: [`apps/api/src/${id}`],
  acceptance: "npx vitest run",
  estimatedCostUsd: 1,
  dependsOn: [],
  ...over,
});
const plan = (over: Record<string, unknown> = {}) => ({
  goal: "add two routes",
  budgetUsd: 4,
  tasks: [task("alpha"), task("beta")],
  integrator: "merge both worktrees, run the suite",
  validator: { prompt: "find what is wrong", canWrite: false, runs: ["npm test"] },
  ...over,
});
const problems = (p: unknown) => validateTeamPlan(p) as string[];

describe("team plan boundaries", () => {
  it("accepts a clean plan", () => expect(problems(plan())).toEqual([]));

  it.each([
    ["an environment file", "infrastructure/docker/.env.prod.example"],
    ["a workflow", ".github/workflows/ci.yml"],
    ["the deployment folder", "infrastructure/deployment/deploy.sh"],
    ["the edge", "infrastructure/edge/Caddyfile"],
    ["terraform", "infrastructure/terraform"],
    ["the Guardians policy", "ops/guardians/claude-guard.mjs"],
    ["a key file", "keys/server.pem"],
    ["the private notes", "NEXORA-private-notes/x.md"],
    ["the whole repository", "."],
    ["a parent of a forbidden folder", "infrastructure"],
  ])("refuses a scope that reaches %s", (_n, scope) => {
    const found = problems(plan({ tasks: [task("alpha", { scope: [scope] })] }));
    expect(found.length).toBeGreaterThan(0);
  });

  it("refuses more than four workers", () => {
    const tasks = ["a1", "b2", "c3", "d4", "e5"].map((id) => task(id));
    expect(problems(plan({ tasks, budgetUsd: 10 })).join()).toMatch(/5 workers/);
  });

  it("refuses overlapping scopes unless dependsOn orders them", () => {
    const clash = [
      task("alpha", { scope: ["apps/api"] }),
      task("beta", { scope: ["apps/api/src/x"] }),
    ];
    expect(problems(plan({ tasks: clash })).join()).toMatch(/overlap/);
    clash[1] = task("beta", { scope: ["apps/api/src/x"], dependsOn: ["alpha"] });
    expect(problems(plan({ tasks: clash }))).toEqual([]);
  });

  it("enforces the budget: above 10, zero, or estimates over the plan's budget", () => {
    expect(problems(plan({ budgetUsd: 11 })).join()).toMatch(/budgetUsd/);
    expect(problems(plan({ budgetUsd: 0 })).join()).toMatch(/budgetUsd/);
    expect(problems(plan({ budgetUsd: 1 })).join()).toMatch(/exceeds budgetUsd/);
  });

  it("requires prompt, acceptance, an integrator and unique ids", () => {
    expect(problems(plan({ tasks: [task("alpha", { acceptance: "" })] })).join()).toMatch(
      /acceptance/,
    );
    expect(problems(plan({ tasks: [task("alpha", { prompt: "" })] })).join()).toMatch(/no prompt/);
    expect(problems(plan({ integrator: "" })).join()).toMatch(/integrator/);
    expect(
      problems(plan({ tasks: [task("alpha"), task("alpha", { scope: ["x/y"] })] })).join(),
    ).toMatch(/duplicate/);
  });

  it("requires an independent, read-only validator that runs the tests", () => {
    expect(
      problems(plan({ validator: { prompt: "x", canWrite: true, runs: ["npm test"] } })).join(),
    ).toMatch(/canWrite/);
    expect(
      problems(plan({ validator: { prompt: "x", canWrite: false, runs: ["lint"] } })).join(),
    ).toMatch(/run the tests/);
    expect(
      problems(
        plan({ validator: { prompt: "Do ALPHA ", canWrite: false, runs: ["npm test"] } }),
      ).join(),
    ).toMatch(/differ/);
    expect(problems(plan({ validator: undefined })).join()).toMatch(/no validator/);
  });

  it("rejects non-objects and empty plans", () => {
    expect(problems(null)).toEqual(["the plan is not an object"]);
    expect(problems(plan({ tasks: [] }))).toContain("no tasks");
  });
});

const review = (verdict: string, commands: string, findings: string, extra = "Wrote files: no") =>
  `## Verdict\n${verdict}\n## Commands run\n${commands}\n## Diff reviewed\n- apps/api/x.ts\n## Findings\n${findings}\n${extra}\n`;
const rv = (t: string) => validateReviewReport(t) as string[];

describe("independent validator report", () => {
  it("accepts a PASS with a command and its result", () => {
    expect(rv(review("PASS", "- npm test -> 597 passed", "none"))).toEqual([]);
  });

  it("accepts a FAIL that names a finding", () => {
    expect(
      rv(review("FAIL", "- npm test -> 3 failed", "- high apps/api/x.ts: wrong status")),
    ).toEqual([]);
  });

  it("rejects a FAIL without a finding, a PASS beside a failing command, and a missing no-write line", () => {
    expect(rv(review("FAIL", "- npm test -> 3 failed", "none")).join()).toMatch(
      /at least one finding/,
    );
    expect(rv(review("PASS", "- npm test -> exit 1", "none")).join()).toMatch(/contradicts/);
    expect(rv(review("PASS", "- npm test -> ok", "none", "")).join()).toMatch(/Wrote files: no/);
  });

  it("rejects a command with no result, a vague verdict and missing sections", () => {
    expect(rv(review("PASS", "- npm test", "none")).join()).toMatch(/no command with a result/);
    expect(rv(review("looks good", "- t -> ok", "none")).join()).toMatch(/PASS or FAIL/);
    expect(rv("## Verdict\nPASS").length).toBeGreaterThan(1);
  });
});

const row = (
  name: string,
  score = "4",
  evidence = "free tier covers it",
  src = "https://example.com/x",
) => `| ${name} | ${score} | ${evidence} | ${src} |`;
const card = (
  rows: string[],
  rec = "trial. cheap to try.",
  adr = "Status: Proposed\nContext: a\nDecision: b\nConsequences: c",
) =>
  `## Candidate\nTool 1.2\n## Scores\n| Criterion | Score | Evidence | Source |\n${rows.join("\n")}\n## Recommendation\n${rec}\n## ADR draft\n${adr}\n`;
const allRows = ["Cost", "Security", "License", "Maintenance", "Fit"].map((n) => row(n));
const cto = (t: string) => validateCtoCard(t) as string[];

describe("CTO card", () => {
  it("accepts a complete card", () => expect(cto(card(allRows))).toEqual([]));

  it.each([
    ["a missing criterion", allRows.slice(1), /no score row for Cost/],
    ["a score of 6", [row("Cost", "6"), ...allRows.slice(1)], /Cost: the score/],
    ["a non-integer score", [row("Cost", "3.5"), ...allRows.slice(1)], /Cost: the score/],
    ["no evidence", [row("Cost", "4", ""), ...allRows.slice(1)], /Cost: no evidence/],
    [
      "no source link",
      [row("Cost", "4", "e", "see docs"), ...allRows.slice(1)],
      /Cost: no source link/,
    ],
  ])("rejects %s", (_n, rows, expected) => {
    expect(cto(card(rows as string[])).join()).toMatch(expected as RegExp);
  });

  it("rejects an unknown recommendation and an incomplete ADR", () => {
    expect(cto(card(allRows, "maybe")).join()).toMatch(/adopt, trial, hold or reject/);
    expect(cto(card(allRows, "adopt", "Status: Proposed\nContext: a")).join()).toMatch(/Decision/);
    expect(cto(card(allRows, "adopt", "Context: a\nDecision: b\nConsequences: c")).join()).toMatch(
      /Status: Proposed/,
    );
  });

  it("rejects a card with missing sections", () => {
    expect(cto("## Candidate\nx").length).toBeGreaterThan(1);
  });
});

describe("the command line", () => {
  const run = (kind: string, input: string) =>
    spawnSync(process.execPath, [path.join(here, "validate-report.mjs"), kind, "-"], {
      encoding: "utf8",
      input,
    });

  it("checks plans (JSON), reviews and cards from stdin", () => {
    expect(run("plan", JSON.stringify(plan())).status).toBe(0);
    expect(run("plan", JSON.stringify(plan({ budgetUsd: 99 }))).status).toBe(1);
    expect(run("plan", "{nope").stderr).toContain("not valid JSON");
    expect(run("review", review("PASS", "- t -> ok", "none")).status).toBe(0);
    expect(run("cto", card(allRows)).status).toBe(0);
    expect(run("cto", "x").status).toBe(1);
  });
});
