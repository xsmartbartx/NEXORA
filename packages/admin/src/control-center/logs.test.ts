import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor, escapeLike, parseLogFilters, summarizeMetadata } from "./logs";

describe("parseLogFilters", () => {
  it("defaults to a 24 hour window with no filters", () => {
    expect(parseLogFilters({})).toEqual({
      namespace: undefined,
      outcome: undefined,
      orgId: undefined,
      q: undefined,
      windowHours: 24,
      cursor: undefined,
    });
  });

  it("accepts valid values and takes the first of a repeated param", () => {
    const filters = parseLogFilters({
      ns: ["sentinel", "cspm"],
      outcome: "failure",
      org: "org_2abcdefghij",
      q: "  scan ",
      window: "168",
    });
    expect(filters).toMatchObject({
      namespace: "sentinel",
      outcome: "failure",
      orgId: "org_2abcdefghij",
      q: "scan",
      windowHours: 168,
    });
  });

  it("drops anything outside the whitelists instead of passing it on", () => {
    const filters = parseLogFilters({
      ns: "x'; drop table audit_events;--",
      outcome: "maybe",
      org: "user_123",
      window: "99999",
      cursor: "not-a-cursor",
    });
    expect(filters.namespace).toBeUndefined();
    expect(filters.outcome).toBeUndefined();
    expect(filters.orgId).toBeUndefined();
    expect(filters.windowHours).toBe(24);
    expect(filters.cursor).toBeUndefined();
  });

  it("caps the search text length", () => {
    expect(parseLogFilters({ q: "a".repeat(500) }).q).toHaveLength(80);
  });
});

describe("cursor", () => {
  it("round-trips a timestamp and id", () => {
    const at = new Date("2026-10-04T05:06:07.123Z");
    const id = "0b6f3a52-1c1e-4a1f-9a55-0e6a1f4f8f10";
    expect(decodeCursor(encodeCursor(at, id))).toEqual({ createdAt: at, id });
  });

  it("rejects malformed cursors", () => {
    expect(decodeCursor("2026-10-04|nope")).toBeNull();
    expect(decodeCursor("")).toBeNull();
  });
});

describe("escapeLike", () => {
  it("escapes wildcards so a search is literal", () => {
    expect(escapeLike("100%_done\\")).toBe("100\\%\\_done\\\\");
    expect(escapeLike("plain")).toBe("plain");
  });
});

describe("summarizeMetadata", () => {
  it("returns null for no metadata and truncates long ones", () => {
    expect(summarizeMetadata(null)).toBeNull();
    expect(summarizeMetadata({ latencyMs: 12 })).toBe('{"latencyMs":12}');
    const long = summarizeMetadata({ note: "x".repeat(400) }, 50)!;
    expect(long.length).toBe(51);
    expect(long.endsWith("…")).toBe(true);
  });
});
