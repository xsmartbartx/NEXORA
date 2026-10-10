import { beforeEach, describe, expect, it, vi } from "vitest";

type Auth =
  | { ok: true; key: { keyId: string; orgId: string; scopes: string[] } }
  | { ok: false; status: 401; code: string; message: string };

let auth: Auth;
const ingest = vi.fn();
const entitlement = vi.fn();

vi.mock("@nexora/database", () => ({
  authenticateApiKey: async () => auth,
  NEURAWALL_LINK_SCOPE: "neurawall:link",
  auditEvents: { id: "id", orgId: "org_id", externalId: "external_id" },
  db: {},
}));
vi.mock("@nexora/billing", () => ({
  getNeurawallEntitlement: (...a: unknown[]) => entitlement(...a),
}));
vi.mock("@nexora/telemetry", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@nexora/telemetry")>();
  return { ...actual, ingestNeurawallEvents: (...a: unknown[]) => ingest(...a) };
});

import { GET as getEntitlement } from "./app/v1/entitlements/neurawall/route";
import { POST as postEvents } from "./app/v1/events/route";

const id = "00000000-0000-4000-8000-000000000001";
const goodEvent = {
  event_id: id,
  type: "neurawall.alert.created",
  ts: 1,
  data: { severity: "low" },
};
const withScope = (orgId = "org_1") => ({
  ok: true as const,
  key: { keyId: "key_1", orgId, scopes: ["neurawall:link"] },
});
const post = (body: unknown, headers: Record<string, string> = {}) =>
  postEvents(
    new Request("https://api.test/v1/events", {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
      headers,
    }),
  );
const get = () => getEntitlement(new Request("https://api.test/v1/entitlements/neurawall"));

beforeEach(() => {
  auth = withScope();
  ingest.mockReset().mockResolvedValue({ stored: 1, duplicates: 0 });
  entitlement.mockReset().mockResolvedValue({
    org_id: "org_1",
    plan_id: "pro",
    current_period_end: 1793000000,
  });
});

describe("GET /v1/entitlements/neurawall", () => {
  it("returns the plan for the key's own organisation, uncached, with rate-limit headers", async () => {
    const res = await get();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      org_id: "org_1",
      plan_id: "pro",
      current_period_end: 1793000000,
    });
    expect(entitlement).toHaveBeenCalledWith("org_1");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("x-ratelimit-limit")).toBeTruthy();
  });

  it("asks for the organisation in the key, whichever key it is", async () => {
    auth = withScope("org_other");
    await get();
    expect(entitlement).toHaveBeenCalledWith("org_other");
  });

  it.each([[[]], [["neurawall"]], [["something:else"]]])(
    "refuses a key whose scopes are %j",
    async (scopes) => {
      auth = { ok: true, key: { keyId: "k", orgId: "org_1", scopes } };
      const res = await get();
      expect(res.status).toBe(403);
      expect((await res.json()).error.code).toBe("insufficient_scope");
      expect(entitlement).not.toHaveBeenCalled();
    },
  );

  it("passes an authentication failure through as 401", async () => {
    auth = { ok: false, status: 401, code: "invalid_api_key", message: "no" };
    expect((await get()).status).toBe(401);
    expect(entitlement).not.toHaveBeenCalled();
  });

  it("answers 503 without leaking the cause when the plan cannot be read", async () => {
    entitlement.mockRejectedValue(new Error("connect ECONNREFUSED 10.1.2.3:5432"));
    const res = await get();
    expect(res.status).toBe(503);
    expect(JSON.stringify(await res.json())).not.toContain("ECONNREFUSED");
  });
});

describe("POST /v1/events", () => {
  it("stores the events for the key's organisation and reports the counts", async () => {
    const res = await post({ events: [goodEvent] });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ stored: 1, duplicates: 0 });
    expect(ingest).toHaveBeenCalledWith("org_1", "key_1", [
      expect.objectContaining({ eventId: id, type: "neurawall.alert.created" }),
    ]);
  });

  it("cannot be pointed at another organisation from the body", async () => {
    const res = await post({ events: [goodEvent], org_id: "org_victim" });
    expect(res.status).toBe(422);
    const res2 = await post({ events: [{ ...goodEvent, org_id: "org_victim" }] });
    expect(res2.status).toBe(422);
    expect(ingest).not.toHaveBeenCalled();
  });

  it("refuses a key without the scope before reading the body", async () => {
    auth = { ok: true, key: { keyId: "k", orgId: "org_1", scopes: [] } };
    const res = await post({ events: [goodEvent] });
    expect(res.status).toBe(403);
    expect(ingest).not.toHaveBeenCalled();
  });

  it("answers 400 for malformed JSON and 422 for a bad event, never storing either", async () => {
    expect((await post("{not json")).status).toBe(400);
    const res = await post({ events: [{ ...goodEvent, type: "sentinel.scan.completed" }] });
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe("invalid_events");
    expect(ingest).not.toHaveBeenCalled();
  });

  it("answers 413 for an oversized body, by header and by actual size", async () => {
    expect((await post({ events: [goodEvent] }, { "content-length": "999999" })).status).toBe(413);
    const huge = JSON.stringify({ events: [goodEvent], pad: "x".repeat(300_000) });
    expect((await post(huge)).status).toBe(413);
    expect(ingest).not.toHaveBeenCalled();
  });

  it("answers 503 without leaking the cause when storage fails", async () => {
    ingest.mockRejectedValue(new Error("duplicate key value violates unique constraint"));
    const res = await post({ events: [goodEvent] });
    expect(res.status).toBe(503);
    expect(JSON.stringify(await res.json())).not.toContain("constraint");
  });

  it("reports duplicates so a retry is visibly harmless", async () => {
    ingest.mockResolvedValue({ stored: 0, duplicates: 1 });
    const res = await post({ events: [goodEvent] });
    expect(await res.json()).toEqual({ stored: 0, duplicates: 1 });
  });
});
