import { describe, expect, it } from "vitest";
import { bucketSeverity, countCodeScanning, countDependabot, daysUntil } from "./security";

describe("bucketSeverity", () => {
  it("maps each vocabulary onto four buckets", () => {
    expect(bucketSeverity("critical")).toBe("critical");
    expect(bucketSeverity("HIGH")).toBe("high");
    expect(bucketSeverity("error")).toBe("high");
    expect(bucketSeverity("moderate")).toBe("medium");
    expect(bucketSeverity("warning")).toBe("medium");
    expect(bucketSeverity("note")).toBe("low");
  });

  it("counts an unknown severity as medium instead of dropping it", () => {
    expect(bucketSeverity(undefined)).toBe("medium");
    expect(bucketSeverity("???")).toBe("medium");
  });
});

describe("alert counting", () => {
  it("prefers a code-scanning alert's security severity over its rule severity", () => {
    const counts = countCodeScanning([
      { rule: { security_severity_level: "critical", severity: "note" } },
      { rule: { severity: "error" } },
      { rule: { severity: "note" } },
    ]);
    expect(counts).toEqual({ critical: 1, high: 1, medium: 0, low: 1 });
  });

  it("counts Dependabot alerts by advisory severity", () => {
    const counts = countDependabot([
      { security_advisory: { severity: "high" } },
      { security_advisory: { severity: "high" } },
      { security_advisory: { severity: "low" } },
    ]);
    expect(counts).toEqual({ critical: 0, high: 2, medium: 0, low: 1 });
  });

  it("rejects a non-list response rather than reporting zero alerts", () => {
    expect(() => countCodeScanning({ message: "Bad credentials" })).toThrow();
    expect(() => countDependabot(null)).toThrow();
  });
});

describe("daysUntil", () => {
  it("counts whole days remaining", () => {
    const now = Date.parse("2026-10-01T00:00:00Z");
    expect(daysUntil("2026-10-31T12:00:00Z", now)).toBe(30);
  });

  it("goes negative once expired", () => {
    const now = Date.parse("2026-10-01T00:00:00Z");
    expect(daysUntil("2026-09-29T00:00:00Z", now)).toBeLessThan(0);
  });
});
