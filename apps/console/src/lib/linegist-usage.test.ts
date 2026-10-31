import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearLinegistUsageCache, getLinegistUsage, signLinegistRequest } from "./linegist-usage";

const env = { LINEGIST_SHARED_SECRET: "test-secret", LINEGIST_URL: "https://linegist.test/" };
const body = {
  product: "linegist",
  period: "2026-10",
  plan: "pro",
  scansUsed: 412,
  scansLimit: 1500,
  extra: 1,
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });

beforeEach(() => clearLinegistUsageCache());

describe("signLinegistRequest", () => {
  // Same vectors as docs/console-contract.md in the Linegist repo.
  it.each([
    [
      "test-secret",
      1790000000,
      "org_demo",
      "3a0846a9293a963ee99f1705acf69e588f70f2fca79a3f87a290149816e9def9",
    ],
    [
      "test-secret",
      1790000000,
      "org_2abc",
      "35f1d2f70931628c81caa87933d13ce05b70950aeb3b46ca895cafab2c0e6d9b",
    ],
    [
      "another-secret",
      1790000000,
      "org_demo",
      "2ac60b7d20d8b89350c697052d07caedd0ecda9da60166e79f21708abf612cd8",
    ],
  ])("matches the contract vector (%s, %s, %s)", (secret, ts, org, sig) => {
    expect(signLinegistRequest(secret, ts, org)).toBe(sig);
  });
});

describe("getLinegistUsage", () => {
  it("is not_configured without a secret and makes no request", async () => {
    const f = vi.fn();
    expect(await getLinegistUsage("org_1", { env: {}, fetch: f })).toEqual({
      status: "not_configured",
    });
    expect(f).not.toHaveBeenCalled();
  });

  it("sends the signed headers to the configured host and returns the usage", async () => {
    const f = vi.fn().mockResolvedValue(json(body));
    const r = await getLinegistUsage("org_demo", { env, fetch: f, now: () => 1790000000_000 });
    expect(r).toEqual({
      status: "ok",
      usage: {
        product: "linegist",
        period: "2026-10",
        plan: "pro",
        scansUsed: 412,
        scansLimit: 1500,
      },
    });
    const [url, init] = f.mock.calls[0];
    expect(url).toBe("https://linegist.test/api/internal/usage?org=org_demo");
    expect(init.headers).toEqual({
      "x-nexora-timestamp": "1790000000",
      "x-nexora-signature": "3a0846a9293a963ee99f1705acf69e588f70f2fca79a3f87a290149816e9def9",
    });
  });

  it("treats 404 as not_started, not an error", async () => {
    const f = vi.fn().mockResolvedValue(json({ error: "not_found" }, 404));
    expect(await getLinegistUsage("org_new", { env, fetch: f })).toEqual({ status: "not_started" });
  });

  it.each([401, 500, 503])("treats %s as unavailable", async (status) => {
    const f = vi.fn().mockResolvedValue(json({ error: "x" }, status));
    expect(await getLinegistUsage("org_1", { env, fetch: f })).toEqual({ status: "unavailable" });
  });

  it("treats a network error and a malformed body as unavailable", async () => {
    expect(
      await getLinegistUsage("a", { env, fetch: vi.fn().mockRejectedValue(new Error("down")) }),
    ).toEqual({
      status: "unavailable",
    });
    clearLinegistUsageCache();
    expect(
      await getLinegistUsage("a", {
        env,
        fetch: vi.fn().mockResolvedValue(json({ product: "other" })),
      }),
    ).toEqual({
      status: "unavailable",
    });
  });

  it("caches per organisation for a minute, failures for a shorter time", async () => {
    let t = 1_000_000;
    const f = vi.fn().mockResolvedValue(json(body));
    await getLinegistUsage("org_a", { env, fetch: f, now: () => t });
    t += 59_000;
    await getLinegistUsage("org_a", { env, fetch: f, now: () => t });
    expect(f).toHaveBeenCalledTimes(1);
    await getLinegistUsage("org_b", { env, fetch: f, now: () => t });
    expect(f).toHaveBeenCalledTimes(2);
    t += 2_000;
    await getLinegistUsage("org_a", { env, fetch: f, now: () => t });
    expect(f).toHaveBeenCalledTimes(3);

    const bad = vi.fn().mockResolvedValue(json({}, 500));
    await getLinegistUsage("org_c", { env, fetch: bad, now: () => t });
    t += 16_000;
    await getLinegistUsage("org_c", { env, fetch: bad, now: () => t });
    expect(bad).toHaveBeenCalledTimes(2);
  });
});
