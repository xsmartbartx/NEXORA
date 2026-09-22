import { NextResponse } from "next/server";
import { apiError } from "./api-error";
import { authenticateRequest, type AuthenticatedKey } from "./api-auth";
import { checkRateLimit } from "./rate-limit";

/**
 * Wraps a v1 route handler with the two things every authenticated endpoint
 * needs (§6.4 machine identity, §7.3 per-organisation quotas): key
 * verification and rate limiting, plus the standard `X-RateLimit-*`
 * headers on every response — success or error.
 */
export async function withApiKey(
  request: Request,
  handler: (key: AuthenticatedKey) => Promise<NextResponse>,
): Promise<NextResponse> {
  const auth = await authenticateRequest(request);
  if (!auth.ok) return apiError(auth.status, auth.code, auth.message);

  const rate = checkRateLimit(auth.key.keyId);
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
