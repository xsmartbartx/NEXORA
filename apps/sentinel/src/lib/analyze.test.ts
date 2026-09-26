import { describe, expect, it } from "vitest";
import { analyzeLogSample } from "./analyze";

const repeated = (line: string, n: number) => Array.from({ length: n }, () => line);

describe("analyzeLogSample", () => {
  it("returns nothing for empty input", () => {
    expect(analyzeLogSample("")).toEqual({ totalLines: 0, findings: [] });
    expect(analyzeLogSample("\n  \n")).toEqual({ totalLines: 0, findings: [] });
  });

  it("assigns keyword severities", () => {
    const result = analyzeLogSample(
      ["kernel panic: out of memory", "request failed", "upstream timeout, retrying"].join("\n"),
    );
    expect(result.findings.map((f) => f.severity)).toEqual(["critical", "warning", "info"]);
    expect(result.findings.map((f) => f.lineNumber)).toEqual([1, 2, 3]);
  });

  it("flags a rare line once there are at least 10 lines", () => {
    const lines = [...repeated("GET /health 200", 49), "user admin logged in from new device"];
    const result = analyzeLogSample(lines.join("\n"));
    expect(result.totalLines).toBe(50);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]).toMatchObject({ lineNumber: 50, severity: "info" });
    expect(result.findings[0]!.reason).toMatch(/Rare pattern/);
  });

  it("does no rarity detection under 10 lines", () => {
    const result = analyzeLogSample(["a", "b", "c"].join("\n"));
    expect(result.findings).toEqual([]);
  });

  it("treats lines differing only in numbers, IPs, UUIDs and timestamps as the same shape", () => {
    const lines = Array.from(
      { length: 20 },
      (_, i) =>
        `2026-09-26T10:00:${String(i).padStart(2, "0")}Z req ${i} from 10.0.0.${i} id 3f2a1b4c-0000-4000-8000-00000000000${i % 10}`,
    );
    expect(analyzeLogSample(lines.join("\n")).findings).toEqual([]);
  });

  it("caps findings at 100", () => {
    const result = analyzeLogSample(repeated("fatal error", 250).join("\n"));
    expect(result.totalLines).toBe(250);
    expect(result.findings).toHaveLength(100);
  });
});
