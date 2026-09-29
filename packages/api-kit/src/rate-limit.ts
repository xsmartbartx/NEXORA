import { Redis } from "ioredis";

/**
 * Fixed-window rate limiting, per-organisation quota layer behind the edge's
 * coarser per-IP/per-host limiting (§7.3). Backed by Redis when `REDIS_URL`
 * is set — a single shared counter per bucket, so every replica of
 * `apps/api`/`apps/gateway` agrees on one count instead of each tracking its
 * own. Falls back to an in-memory counter (per-instance only) when no
 * `REDIS_URL` is configured — local dev, or Redis itself being unreachable —
 * so a missing/down cache degrades the limiter rather than taking down
 * every authenticated request.
 */
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 60;

export interface RateLimitResult {
  limited: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const memoryBuckets = new Map<string, Bucket>();

function checkRateLimitMemory(bucketKey: string): RateLimitResult {
  const now = Date.now();
  const bucket = memoryBuckets.get(bucketKey);

  if (!bucket || bucket.resetAt <= now) {
    memoryBuckets.set(bucketKey, { count: 1, resetAt: now + WINDOW_MS });
    return {
      limited: false,
      limit: MAX_REQUESTS_PER_WINDOW,
      remaining: MAX_REQUESTS_PER_WINDOW - 1,
      resetAt: now + WINDOW_MS,
    };
  }

  bucket.count += 1;
  const remaining = MAX_REQUESTS_PER_WINDOW - bucket.count;
  return {
    limited: remaining < 0,
    limit: MAX_REQUESTS_PER_WINDOW,
    remaining: Math.max(remaining, 0),
    resetAt: bucket.resetAt,
  };
}

/**
 * `INCR` is atomic across concurrent requests hitting the same bucket, so
 * two replicas incrementing at once still land on distinct counts rather
 * than racing. Only the request that takes the count to 1 sets the
 * expiry — otherwise every hit would push the window back out and the
 * limit would never actually reset.
 */
async function checkRateLimitRedis(bucketKey: string, redis: Redis): Promise<RateLimitResult> {
  const now = Date.now();
  const count = await redis.incr(bucketKey);
  if (count === 1) {
    await redis.pexpire(bucketKey, WINDOW_MS);
  }
  const ttl = await redis.pttl(bucketKey);
  const resetAt = now + (ttl > 0 ? ttl : WINDOW_MS);
  const remaining = MAX_REQUESTS_PER_WINDOW - count;
  return {
    limited: remaining < 0,
    limit: MAX_REQUESTS_PER_WINDOW,
    remaining: Math.max(remaining, 0),
    resetAt,
  };
}

let redisClient: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redisClient !== undefined) return redisClient;

  const url = process.env.REDIS_URL;
  if (!url) {
    redisClient = null;
    return null;
  }

  redisClient = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1 });
  // Without a listener, ioredis rethrows connection errors as an unhandled
  // 'error' event and crashes the process; checkRateLimit's own try/catch
  // is what actually handles a failed request, this just keeps the client
  // alive to retry on the next one.
  redisClient.on("error", () => {});
  return redisClient;
}

/**
 * `namespace` keeps one API key's usage of `apps/api` separate from its use
 * of `apps/gateway` (or any other product) — otherwise calling both from
 * the same key would share one bucket by accident.
 */
export async function checkRateLimit(key: string, namespace: string): Promise<RateLimitResult> {
  const bucketKey = `ratelimit:${namespace}:${key}`;
  const redis = getRedis();
  if (!redis) return checkRateLimitMemory(bucketKey);

  try {
    return await checkRateLimitRedis(bucketKey, redis);
  } catch {
    // Redis unreachable: fail open to the in-memory limiter for this
    // request rather than rejecting or blocking all authenticated traffic.
    return checkRateLimitMemory(bucketKey);
  }
}

/** Test-only: drop every in-memory bucket. */
export function resetRateLimitMemory() {
  memoryBuckets.clear();
}
