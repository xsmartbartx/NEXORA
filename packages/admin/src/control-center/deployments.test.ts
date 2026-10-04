import { describe, expect, it } from "vitest";
import { parseLatestRelease, parseMergedPulls, summarizeCheckRuns } from "./deployments";

const pr = (number: number, merged_at: string | null) => ({
  number,
  title: `PR ${number}`,
  merged_at,
  html_url: `https://github.com/o/r/pull/${number}`,
  user: { login: "dev" },
});

describe("parseMergedPulls", () => {
  it("keeps only merged PRs, ordered by merge time not update time", () => {
    const merged = parseMergedPulls([
      pr(1, "2026-10-01T00:00:00Z"),
      pr(2, null),
      pr(3, "2026-10-03T00:00:00Z"),
      pr(4, "2026-10-02T00:00:00Z"),
    ]);
    expect(merged.map((m) => m.number)).toEqual([3, 4, 1]);
  });

  it("limits the list and rejects a non-array body", () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      pr(i, `2026-10-${String(i + 1).padStart(2, "0")}T00:00:00Z`),
    );
    expect(parseMergedPulls(many, 5)).toHaveLength(5);
    expect(() => parseMergedPulls({ message: "Not Found" })).toThrow();
  });
});

describe("parseLatestRelease", () => {
  it("reads a release and returns null for anything else", () => {
    expect(
      parseLatestRelease({
        tag_name: "v0.1.0",
        published_at: "2026-10-03T00:00:00Z",
        html_url: "u",
      }),
    ).toEqual({ tag: "v0.1.0", publishedAt: "2026-10-03T00:00:00Z", url: "u" });
    expect(parseLatestRelease({ message: "Not Found" })).toBeNull();
    expect(parseLatestRelease(null)).toBeNull();
  });
});

describe("summarizeCheckRuns", () => {
  const run = (status: string, conclusion: string | null) => ({ status, conclusion });

  it("is success when everything passed or was skipped", () => {
    expect(
      summarizeCheckRuns({
        check_runs: [run("completed", "success"), run("completed", "skipped")],
      }),
    ).toBe("success");
  });

  it("any failure wins over pending runs", () => {
    expect(
      summarizeCheckRuns({ check_runs: [run("in_progress", null), run("completed", "failure")] }),
    ).toBe("failure");
  });

  it("reports pending while anything is still running, and none for no runs", () => {
    expect(
      summarizeCheckRuns({ check_runs: [run("queued", null), run("completed", "success")] }),
    ).toBe("pending");
    expect(summarizeCheckRuns({ check_runs: [] })).toBe("none");
  });

  it("rejects an unexpected body", () => {
    expect(() => summarizeCheckRuns({ message: "x" })).toThrow();
  });
});
