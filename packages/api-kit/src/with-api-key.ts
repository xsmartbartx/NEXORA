import { NextResponse } from "next/server";
import { authenticateApiKey, type AuthenticatedKey } from "@nexora/database";
import { apiError } from "./error";
import { checkRateLimit } from "./rate-limit";

/**
 * Wraps a machine-facing route handler with the two things every
 * authenticated endpoint needs (§6.4 machine identity, §7.3
 * per-organisation quotas): key verification and rate limiting, plus the
 * standard `X-RateLimit-*` headers on every response — success or error.
 * `namespace` scopes the rate-limit bucket per product (e.g. "api",
 * "gateway") so one key's usage of one product doesn't count against
 * another's limit.
 */
export async function withApiKey(
  request: Request,
  namespace: string,
  handler: (key: AuthenticatedKey) => Promise<NextResponse>,
): Promise<NextResponse> {
  const auth = await authenticateApiKey(request);
  if (!auth.ok) return apiError(auth.status, auth.code, auth.message);

  const rate = checkRateLimit(auth.key.keyId, namespace);
  const rateLimitHeaders = {
    "X-RateLimit-Limit": String(rate.limit),
    "X-RateLimit-Remaining": String(rate.remaining),
    "X-RateLimit-Reset": String(Math.floor(rate.resetAt / 1000)),
  };

  const response = rate.limited
    ? apiError(429, "rate_limited", "Rate limit exceeded. Retry after X-RateLimit-Reset.")
    : await handler(auth.key);

  for (const [name, value] of Object.entries(rateLimitHeaders)) {
    response.headers.set(name, value);
  }
  return response;
}
