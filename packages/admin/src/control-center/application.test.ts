import { describe, expect, it } from "vitest";
import { latestRunPerWorkflow, parseSentryIssues, summarizeLatency } from "./application";
import type { EndpointResult } from "./health";

const result = (name: string, latencyMs: number | null): EndpointResult => ({
  name,
  url: `https://${name}.test`,
  category: "platform",
  status: latencyMs === null ? "down" : "up",
  httpStatus: latencyMs === null ? null : 200,
  latencyMs,
});

describe("summarizeLatency", () => {
  it("averages and ranks only the endpoints that answered", () => {
    const summary = summarizeLatency([
      result("a", 100),
      result("b", 300),
      result("c", null),
      result("d", 200),
      result("e", 400),
    ]);
    expect(summary.sampled).toBe(4);
    expect(summary.averageMs).toBe(250);
    expect(summary.slowest.map((s) => s.name)).toEqual(["e", "b", "d"]);
  });

  it("reports no average when nothing answered", () => {
    expect(summarizeLatency([result("a", null)])).toEqual({
      sampled: 0,
      averageMs: null,
      slowest: [],
    });
  });
});

describe("parseSentryIssues", () => {
  it("counts issues and ranks by event count", () => {
    const summary = parseSentryIssues([
      { id: "1", title: "A", level: "error", count: "5", permalink: "https://sentry.test/1" },
      { id: "2", title: "B", level: "warning", count: "50", permalink: "https://sentry.test/2" },
    ]);
    expect(summary.unresolved).toBe(2);
    expect(summary.capped).toBe(false);
    expect(summary.top[0]).toMatchObject({ id: "2", count: 50 });
  });

  it("flags a full page as a lower bound", () => {
    const page = Array.from({ length: 100 }, (_, i) => ({ id: String(i), count: "1" }));
    expect(parseSentryIssues(page).capped).toBe(true);
  });

  it("rejects a non-list response", () => {
    expect(() => parseSentryIssues({ detail: "Invalid token" })).toThrow();
  });
});

describe("latestRunPerWorkflow", () => {
  it("keeps only the newest run of each workflow", () => {
    const runs = latestRunPerWorkflow({
      workflow_runs: [
        {
          name: "CI",
          conclusion: "success",
          status: "completed",
          html_url: "u1",
          updated_at: "t1",
          head_commit: { message: "newest\nbody" },
        },
        {
          name: "CodeQL",
          conclusion: "failure",
          status: "completed",
          html_url: "u2",
          updated_at: "t2",
          head_commit: null,
        },
        {
          name: "CI",
          conclusion: "failure",
          status: "completed",
          html_url: "u3",
          updated_at: "t3",
          head_commit: { message: "older" },
        },
      ],
    });
    expect(runs.map((r) => r.name)).toEqual(["CI", "CodeQL"]);
    expect(runs[0]).toMatchObject({ conclusion: "success", commit: "newest" });
  });

  it("groups by workflow id, since one workflow's runs carry different display names", () => {
    const codeql = {
      workflow_id: 7,
      path: "dynamic/github-code-scanning/codeql",
      status: "completed",
    };
    const runs = latestRunPerWorkflow({
      workflow_runs: [
        { ...codeql, name: "CodeQL", conclusion: "failure" },
        { ...codeql, name: "Push on main", conclusion: "success" },
        {
          workflow_id: 8,
          path: ".github/workflows/ci.yml",
          name: "CI",
          conclusion: "success",
          status: "completed",
        },
      ],
    });
    expect(runs).toHaveLength(2);
    expect(runs[0]).toMatchObject({ name: "CodeQL", conclusion: "failure" });
  });

  it("labels CodeQL runs consistently regardless of their title", () => {
    const [run] = latestRunPerWorkflow({
      workflow_runs: [
        {
          workflow_id: 7,
          name: "Push on main",
          path: "dynamic/github-code-scanning/codeql",
          conclusion: "success",
          status: "completed",
        },
      ],
    });
    expect(run!.name).toBe("CodeQL");
  });

  it("ignores Dependabot graph-update bookkeeping runs", () => {
    const runs = latestRunPerWorkflow({
      workflow_runs: [
        {
          workflow_id: 9,
          name: "Graph Update: uv in /. #1",
          path: "dynamic/dependabot/update-graph",
          conclusion: "success",
          status: "completed",
        },
        {
          workflow_id: 8,
          name: "CI",
          path: ".github/workflows/ci.yml",
          conclusion: "success",
          status: "completed",
        },
      ],
    });
    expect(runs.map((r) => r.name)).toEqual(["CI"]);
  });

  it("treats an in-progress run as having no conclusion yet", () => {
    const [run] = latestRunPerWorkflow({
      workflow_runs: [{ name: "CI", conclusion: null, status: "in_progress" }],
    });
    expect(run).toMatchObject({ conclusion: null, status: "in_progress" });
  });

  it("rejects an unexpected response", () => {
    expect(() => latestRunPerWorkflow({ message: "Not Found" })).toThrow();
  });
});
