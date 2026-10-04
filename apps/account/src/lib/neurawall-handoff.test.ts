import { describe, expect, it } from "vitest";
import { buildNeurawallHandoffUrl, isValidHandoffState } from "./neurawall-handoff";

describe("isValidHandoffState", () => {
  it("accepts a url-safe nonce of sensible length", () => {
    expect(isValidHandoffState("a".repeat(16))).toBe(true);
    expect(isValidHandoffState("Ab3_-".repeat(8))).toBe(true);
  });

  it("rejects missing, short, long and non url-safe values", () => {
    for (const bad of [
      null,
      "",
      "short",
      "a".repeat(129),
      "has space aaaaaaaaaaaa",
      "x&y=zzzzzzzzzzzzzzzz",
      "a/b".repeat(10),
    ]) {
      expect(isValidHandoffState(bad)).toBe(false);
    }
  });
});

describe("buildNeurawallHandoffUrl", () => {
  it("puts the token in the fragment on the NeuraWall origin", () => {
    const url = buildNeurawallHandoffUrl("tok.en+/=", "s".repeat(20), "https://nw.test");
    expect(url).toBe(`https://nw.test/#sso_token=tok.en%2B%2F%3D&state=${"s".repeat(20)}`);
  });

  it("only ever uses the origin of the configured URL", () => {
    expect(buildNeurawallHandoffUrl("t", "s".repeat(20), "https://nw.test/some/path?x=1")).toMatch(
      /^https:\/\/nw\.test\/#sso_token=/,
    );
  });

  it("defaults to production NeuraWall", () => {
    expect(buildNeurawallHandoffUrl("t", "s".repeat(20))).toMatch(
      /^https:\/\/neurawall\.onenexora\.com\/#/,
    );
  });
});
