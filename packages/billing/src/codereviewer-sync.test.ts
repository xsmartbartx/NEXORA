import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  codereviewerLinkUrl,
  codereviewerPlanFor,
  signCodeReviewer,
  syncCodeReviewerPlan,
} from "./codereviewer-sync";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("codereviewerPlanFor", () => {
  it("is the subscribed tier only while the subscription is active or trialing", () => {
    expect(codereviewerPlanFor("pro", "active")).toBe("pro");
    expect(codereviewerPlanFor("team", "trialing")).toBe("team");
    for (const status of ["past_due", "canceled", "unpaid", "incomplete", "paused"]) {
      expect(codereviewerPlanFor("team", status)).toBe("free");
    }
    expect(codereviewerPlanFor("scale", "active")).toBe("free");
  });
});

describe("signCodeReviewer", () => {
  it("is HMAC-SHA256 over '<prefix><timestamp>.<body>' in hex", () => {
    const expected = createHmac("sha256", "s3cret").update('1700000000.{"a":1}').digest("hex");
    expect(signCodeReviewer("s3cret", 1_700_000_000, '{"a":1}')).toBe(expected);
    expect(signCodeReviewer("k", 1, "b", "link.")).toBe(
      createHmac("sha256", "k").update("link.1.b").digest("hex"),
    );
    expect(signCodeReviewer("k", 1, "b", "link.")).not.toBe(signCodeReviewer("k", 1, "b"));
  });
});

describe("syncCodeReviewerPlan", () => {
  it("does nothing until a shared secret is configured", async () => {
    vi.stubEnv("CODEREVIEWER_SYNC_SECRET", "");
    const fetchImpl = vi.fn();
    expect(
      await syncCodeReviewerPlan({ orgId: "org_1", planId: "pro", asOf: 1 }, { fetchImpl }),
    ).toBe("skipped");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("posts the signed plan and the event time to CodeReviewer", async () => {
    vi.stubEnv("CODEREVIEWER_SYNC_SECRET", "s3cret");
    vi.stubEnv("CODEREVIEWER_URL", "https://cr.test/");
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));

    const result = await syncCodeReviewerPlan(
      { orgId: "org_1", planId: "team", asOf: 1_699_999_000 },
      { fetchImpl: fetchImpl as unknown as typeof fetch, now: () => 1_700_000_000_000 },
    );

    expect(result).toBe("synced");
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://cr.test/api/internal/org-plan");
    const body = init.body as string;
    expect(JSON.parse(body)).toEqual({
      clerk_org_id: "org_1",
      plan_id: "team",
      as_of: 1_699_999_000,
    });
    const headers = init.headers as Record<string, string>;
    expect(headers["X-Nexora-Timestamp"]).toBe("1700000000");
    expect(headers["X-Nexora-Signature"]).toBe(signCodeReviewer("s3cret", 1_700_000_000, body));
  });

  it("throws on a non-2xx answer so Stripe redelivers the event", async () => {
    vi.stubEnv("CODEREVIEWER_SYNC_SECRET", "s3cret");
    const fetchImpl = vi.fn(async () => new Response("no", { status: 503 }));
    await expect(
      syncCodeReviewerPlan(
        { orgId: "org_1", planId: "free", asOf: 1 },
        { fetchImpl: fetchImpl as unknown as typeof fetch },
      ),
    ).rejects.toThrow(/503/);
  });
});

describe("codereviewerLinkUrl", () => {
  const grant = {
    orgId: "org_2abcdefghijkl",
    orgName: "Acme Inc",
    accountId: "6f1c1f9e-0000-4000-8000-000000000000",
    nonce: "n".repeat(43),
    planId: "pro" as const,
  };

  it("refuses to sign without the shared secret", () => {
    vi.stubEnv("CODEREVIEWER_SYNC_SECRET", "");
    expect(() => codereviewerLinkUrl(grant)).toThrow(/not configured/);
  });

  it("sends the browser to CodeReviewer's fixed origin with a grant signed under the link prefix", () => {
    vi.stubEnv("CODEREVIEWER_SYNC_SECRET", "s3cret");
    vi.stubEnv("CODEREVIEWER_URL", "https://cr.test");
    const url = new URL(codereviewerLinkUrl(grant, 1_700_000_000_000));
    expect(url.origin + url.pathname).toBe("https://cr.test/api/nexora/link/complete");

    const body = Buffer.from(url.searchParams.get("grant")!, "base64url").toString("utf8");
    expect(JSON.parse(body)).toEqual({
      org_id: grant.orgId,
      org_name: "Acme Inc",
      account_id: grant.accountId,
      nonce: grant.nonce,
      plan_id: "pro",
    });
    expect(url.searchParams.get("ts")).toBe("1700000000");
    expect(url.searchParams.get("sig")).toBe(
      createHmac("sha256", "s3cret").update(`link.1700000000.${body}`).digest("hex"),
    );
  });
});
