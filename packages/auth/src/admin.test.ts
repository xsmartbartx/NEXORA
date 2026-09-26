import { describe, expect, it } from "vitest";
import { adminEmailFor, parseAdminAllowlist } from "./admin";

const user = (emailAddress: string, status: string | null = "verified") => ({
  primaryEmailAddress: { emailAddress, verification: { status } },
});

describe("parseAdminAllowlist", () => {
  it("normalises case and whitespace and drops empties", () => {
    expect(parseAdminAllowlist(" Boss@Example.com, ,ops@example.com ")).toEqual([
      "boss@example.com",
      "ops@example.com",
    ]);
    expect(parseAdminAllowlist(undefined)).toEqual([]);
  });
});

describe("adminEmailFor", () => {
  const allowlist = ["boss@example.com"];

  it("admits a verified, allowlisted primary email regardless of case", () => {
    expect(adminEmailFor(user("Boss@Example.com"), allowlist)).toBe("boss@example.com");
  });

  it("rejects an allowlisted email that isn't verified", () => {
    expect(adminEmailFor(user("boss@example.com", "unverified"), allowlist)).toBeNull();
    expect(adminEmailFor(user("boss@example.com", null), allowlist)).toBeNull();
  });

  it("rejects everyone else, and everyone when the allowlist is empty", () => {
    expect(adminEmailFor(user("someone@example.com"), allowlist)).toBeNull();
    expect(adminEmailFor(user("boss@example.com"), [])).toBeNull();
    expect(adminEmailFor(null, allowlist)).toBeNull();
    expect(adminEmailFor({ primaryEmailAddress: null }, allowlist)).toBeNull();
  });
});
