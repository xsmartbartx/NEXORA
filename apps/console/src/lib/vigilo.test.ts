import { describe, expect, it } from "vitest";
import { fetchVigiloAccount } from "./vigilo";

const json = (body: unknown, status = 200) =>
  (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe("fetchVigiloAccount", () => {
  it("maps the entitlements of /v1/me", async () => {
    const account = await fetchVigiloAccount("t", {
      baseUrl: "https://v.test",
      fetchImpl: json({
        entitlements: { plan_id: "pro", scans_per_month_limit: null, targets_limit: 25 },
      }),
    });
    expect(account).toEqual({ planId: "pro", scansPerMonthLimit: null, targetsLimit: 25 });
  });

  it("sends the bearer token to /v1/me", async () => {
    let seen: { url: string; auth: string | null } | undefined;
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      seen = { url, auth: new Headers(init?.headers).get("Authorization") };
      return new Response("{}", { status: 401 });
    }) as unknown as typeof fetch;
    await fetchVigiloAccount("tok", { baseUrl: "https://v.test/", fetchImpl });
    expect(seen).toEqual({ url: "https://v.test/v1/me", auth: "Bearer tok" });
  });

  it("rejects a response with a missing or mistyped limit, but keeps explicit null", async () => {
    const withLimits = (limits: Record<string, unknown>) =>
      json({ entitlements: { plan_id: "pro", ...limits } });
    const base = { baseUrl: "https://v.test" };
    expect(
      await fetchVigiloAccount("t", { ...base, fetchImpl: withLimits({ targets_limit: 5 }) }),
    ).toBeNull();
    expect(
      await fetchVigiloAccount("t", {
        ...base,
        fetchImpl: withLimits({ scans_per_month_limit: "3", targets_limit: 5 }),
      }),
    ).toBeNull();
    expect(
      await fetchVigiloAccount("t", {
        ...base,
        fetchImpl: withLimits({ scans_per_month_limit: null, targets_limit: null }),
      }),
    ).toEqual({ planId: "pro", scansPerMonthLimit: null, targetsLimit: null });
  });

  it("never sends the token over plain http", async () => {
    let called = false;
    const fetchImpl = (async () => {
      called = true;
      return new Response("{}");
    }) as unknown as typeof fetch;
    expect(await fetchVigiloAccount("t", { baseUrl: "http://v.test", fetchImpl })).toBeNull();
    expect(await fetchVigiloAccount("t", { baseUrl: "not a url", fetchImpl })).toBeNull();
    expect(called).toBe(false);
  });

  it("returns null on HTTP errors, bad shapes and network failures", async () => {
    expect(await fetchVigiloAccount("t", { fetchImpl: json({}, 500) })).toBeNull();
    expect(
      await fetchVigiloAccount("t", {
        fetchImpl: json({ entitlements: { scans_per_month_limit: null, targets_limit: null } }),
      }),
    ).toBeNull();
    const boom = (async () => {
      throw new Error("down");
    }) as unknown as typeof fetch;
    expect(await fetchVigiloAccount("t", { fetchImpl: boom })).toBeNull();
  });
});
