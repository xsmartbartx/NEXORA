import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { signVigiloSync, syncVigiloPlan, vigiloPlanFor } from "./vigilo-sync";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("vigiloPlanFor", () => {
  it("is Pro only while the subscription is active or trialing", () => {
    expect(vigiloPlanFor("active")).toBe("pro");
    expect(vigiloPlanFor("trialing")).toBe("pro");
    for (const status of ["past_due", "canceled", "unpaid", "incomplete", "paused"]) {
      expect(vigiloPlanFor(status)).toBe("free");
    }
  });
});

describe("signVigiloSync", () => {
  it("is HMAC-SHA256 over '<timestamp>.<body>' in hex", () => {
    const expected = createHmac("sha256", "s3cret").update('1700000000.{"a":1}').digest("hex");
    expect(signVigiloSync("s3cret", 1_700_000_000, '{"a":1}')).toBe(expected);
  });

  it("changes with the secret, the timestamp and the body", () => {
    const base = signVigiloSync("k", 1, "b");
    expect(signVigiloSync("k2", 1, "b")).not.toBe(base);
    expect(signVigiloSync("k", 2, "b")).not.toBe(base);
    expect(signVigiloSync("k", 1, "b2")).not.toBe(base);
  });
});

describe("syncVigiloPlan", () => {
  it("does nothing until a shared secret is configured", async () => {
    vi.stubEnv("NEXORA_SYNC_SECRET", "");
    const fetchImpl = vi.fn();
    expect(await syncVigiloPlan({ orgId: "org_1", planId: "pro" }, { fetchImpl })).toBe("skipped");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("posts the signed plan to Vigilo", async () => {
    vi.stubEnv("NEXORA_SYNC_SECRET", "s3cret");
    vi.stubEnv("VIGILO_API_URL", "https://vigilo.test/");
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));

    const result = await syncVigiloPlan(
      { orgId: "org_1", planId: "pro" },
      { fetchImpl: fetchImpl as unknown as typeof fetch, now: () => 1_700_000_000_000 },
    );

    expect(result).toBe("synced");
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://vigilo.test/v1/internal/org-plan");
    const body = init.body as string;
    expect(JSON.parse(body)).toEqual({ clerk_org_id: "org_1", plan_id: "pro" });
    const headers = init.headers as Record<string, string>;
    expect(headers["X-Nexora-Timestamp"]).toBe("1700000000");
    expect(headers["X-Nexora-Signature"]).toBe(signVigiloSync("s3cret", 1_700_000_000, body));
  });

  it("throws on a non-2xx answer so Stripe redelivers the event", async () => {
    vi.stubEnv("NEXORA_SYNC_SECRET", "s3cret");
    const fetchImpl = vi.fn(async () => new Response("no", { status: 503 }));
    await expect(
      syncVigiloPlan(
        { orgId: "org_1", planId: "free" },
        { fetchImpl: fetchImpl as unknown as typeof fetch },
      ),
    ).rejects.toThrow(/503/);
  });
});
