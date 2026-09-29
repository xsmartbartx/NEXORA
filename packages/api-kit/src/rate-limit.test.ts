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
  const exec = vi.fn();
  const calls: unknown[][] = [];

  beforeEach(() => {
    vi.resetModules();
    process.env.REDIS_URL = "redis://localhost:6379";
    exec.mockReset();
    calls.length = 0;

    // A plain function, not an arrow function: `new Redis(...)` in the
    // module under test requires something callable with `new`.
    vi.doMock("ioredis", () => ({
      Redis: vi.fn().mockImplementation(function MockRedis() {
        const tx = {
          incr: (...args: unknown[]) => (calls.push(["incr", ...args]), tx),
          pexpire: (...args: unknown[]) => (calls.push(["pexpire", ...args]), tx),
          pttl: (...args: unknown[]) => (calls.push(["pttl", ...args]), tx),
          exec,
        };
        return { multi: () => tx, on: vi.fn() };
      }),
    }));
  });

  afterEach(() => {
    delete process.env.REDIS_URL;
    vi.doUnmock("ioredis");
  });

  it("increments and sets the expiry in one transaction, only if unset", async () => {
    exec.mockResolvedValueOnce([
      [null, 1],
      [null, 1],
      [null, 60_000],
    ]);
    const { checkRateLimit } = await import("./rate-limit");

    const result = await checkRateLimit("key-1", "api");

    expect(calls).toEqual([
      ["incr", "ratelimit:api:key-1"],
      ["pexpire", "ratelimit:api:key-1", 60_000, "NX"],
      ["pttl", "ratelimit:api:key-1"],
    ]);
    expect(exec).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ limited: false, remaining: 59 });
  });

  it("reports limited once the shared Redis counter exceeds the max", async () => {
    exec.mockResolvedValueOnce([
      [null, 61],
      [null, 0],
      [null, 10_000],
    ]);
    const { checkRateLimit } = await import("./rate-limit");

    const result = await checkRateLimit("key-1", "api");

    expect(result).toMatchObject({ limited: true, remaining: 0 });
  });

  it("falls back to the in-memory limiter when Redis throws", async () => {
    exec.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const { checkRateLimit, resetRateLimitMemory } = await import("./rate-limit");
    resetRateLimitMemory();

    const result = await checkRateLimit("key-1", "api");

    expect(result).toMatchObject({ limited: false, remaining: 59 });
  });

  it("falls back when a command inside the transaction errors", async () => {
    exec.mockResolvedValueOnce([
      [new Error("OOM"), null],
      [null, 0],
      [null, -1],
    ]);
    const { checkRateLimit, resetRateLimitMemory } = await import("./rate-limit");
    resetRateLimitMemory();

    const result = await checkRateLimit("key-1", "api");

    expect(result).toMatchObject({ limited: false, remaining: 59 });
  });
});
