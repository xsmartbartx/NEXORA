import { describe, expect, it } from "vitest";
import { codereviewerPlanId, parseLinkRequest } from "./codereviewer-link";

const valid = {
  account: "6f1c1f9e-0000-4000-8000-000000000000",
  login: "acme-inc",
  nonce: "Abc_-".repeat(9),
};

describe("parseLinkRequest", () => {
  it("accepts a well-formed request from the query string or a form", () => {
    expect(parseLinkRequest(valid)).toEqual({
      accountId: valid.account,
      login: "acme-inc",
      nonce: valid.nonce,
    });
    const form = new FormData();
    for (const [key, value] of Object.entries(valid)) form.set(key, value);
    expect(parseLinkRequest(form)).toEqual(parseLinkRequest(valid));
  });

  it.each([
    ["a missing field", { ...valid, nonce: undefined }],
    ["a non-uuid account", { ...valid, account: "1; drop table" }],
    ["a login GitHub would not issue", { ...valid, login: "-acme" }],
    ["a login with markup", { ...valid, login: "<b>acme</b>" }],
    ["a short nonce", { ...valid, nonce: "abc" }],
    ["a repeated parameter", { ...valid, account: [valid.account, valid.account] }],
  ])("rejects %s", (_label, input) => {
    expect(parseLinkRequest(input)).toBeNull();
  });
});

describe("codereviewerPlanId", () => {
  it("maps the catalogue tier to CodeReviewer's plan ids, Free for anything else", () => {
    expect(codereviewerPlanId("pro")).toBe("pro");
    expect(codereviewerPlanId("team")).toBe("team");
    expect(codereviewerPlanId("free")).toBe("free");
    expect(codereviewerPlanId("scale")).toBe("free");
  });
});
