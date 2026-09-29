import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("checkRateLimit (in-memory, no REDIS_URL)", () => {
  beforeEach(async () => {
    vi.resetModules();
    delete process.env.REDIS_URL;
    const { resetRateLimitMemory } = await import("./rate-limit");
    resetRateLimitMemory();
  });

  it("allows requests under the limit", async () => {
    const { checkRateLimit } = await import("./rate-limit");
    const result = await checkRateLimit("key-1", "api");
    expect(result).toMatchObject({ limited: false, limit: 60, remaining: 59 });
  });

  it("limits once the window's requests are exhausted", async () => {
    const { checkRateLimit } = await import("./rate-limit");
    let result;
    for (let i = 0; i < 61; i++) {
      result = await checkRateLimit("key-2", "api");
    }
    expect(result).toMatchObject({ limited: true, remaining: 0 });
  });

  it("keeps namespaces independent for the same key", async () => {
    const { checkRateLimit } = await import("./rate-limit");
    for (let i = 0; i < 60; i++) await checkRateLimit("key-3", "api");
    const gateway = await checkRateLimit("key-3", "gateway");
    expect(gateway.limited).toBe(false);
  });
});

describe("checkRateLimit (Redis-backed)", () => {
  const incr = vi.fn();
  const pexpire = vi.fn();
  const pttl = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    process.env.REDIS_URL = "redis://localhost:6379";
    incr.mockReset();
    pexpire.mockReset();
    pttl.mockReset();

    // A plain function, not an arrow function: `new Redis(...)` in the
    // module under test requires something callable with `new`, and
    // returning an object from it is what supplies the mocked instance.
    vi.doMock("ioredis", () => ({
      Redis: vi.fn().mockImplementation(function MockRedis() {
        return { incr, pexpire, pttl, on: vi.fn() };
      }),
    }));
  });

  afterEach(() => {
    delete process.env.REDIS_URL;
    vi.doUnmock("ioredis");
  });

  it("sets the window's expiry only on the first hit", async () => {
    incr.mockResolvedValueOnce(1);
    pttl.mockResolvedValueOnce(60_000);
    const { checkRateLimit } = await import("./rate-limit");

    const result = await checkRateLimit("key-1", "api");

    expect(pexpire).toHaveBeenCalledWith("ratelimit:api:key-1", 60_000);
    expect(result).toMatchObject({ limited: false, remaining: 59 });
  });

  it("does not re-set expiry on subsequent hits in the same window", async () => {
    incr.mockResolvedValueOnce(2);
    pttl.mockResolvedValueOnce(45_000);
    const { checkRateLimit } = await import("./rate-limit");

    await checkRateLimit("key-1", "api");

    expect(pexpire).not.toHaveBeenCalled();
  });

  it("reports limited once the shared Redis counter exceeds the max", async () => {
    incr.mockResolvedValueOnce(61);
    pttl.mockResolvedValueOnce(10_000);
    const { checkRateLimit } = await import("./rate-limit");

    const result = await checkRateLimit("key-1", "api");

    expect(result).toMatchObject({ limited: true, remaining: 0 });
  });

  it("falls back to the in-memory limiter when Redis throws", async () => {
    incr.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const { checkRateLimit, resetRateLimitMemory } = await import("./rate-limit");
    resetRateLimitMemory();

    const result = await checkRateLimit("key-1", "api");

    expect(result).toMatchObject({ limited: false, remaining: 59 });
  });
});
