/**
 * Fixed-window rate limiting, in memory. Coarse edge-level rate limiting
 * (per IP, per host) belongs at the edge per §7.3 — this is the
 * per-organisation quota layer that sits behind it, which the edge table
 * explicitly leaves to the application.
 *
 * In-memory means per-instance: fine for a single-process deploy or local
 * dev, but each serverless/replica instance would track its own count
 * rather than sharing one. Move the store to Redis/Upstash before running
 * more than one instance in production — nothing about the call sites below
 * would need to change, only this file's internals.
 */
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 60;

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  limited: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

/**
 * `namespace` keeps one API key's usage of `apps/api` separate from its use
 * of `apps/gateway` (or any other product) — otherwise calling both from
 * the same key would share one bucket by accident.
 */
export function checkRateLimit(key: string, namespace: string): RateLimitResult {
  const bucketKey = `${namespace}:${key}`;
  const now = Date.now();
  const bucket = buckets.get(bucketKey);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(bucketKey, { count: 1, resetAt: now + WINDOW_MS });
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
