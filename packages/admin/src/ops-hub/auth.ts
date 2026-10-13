import { createHash, timingSafeEqual } from "node:crypto";

export type BearerResult = "ok" | "unauthorized" | "disabled";

/** A token shorter than this is treated as "not configured": a weak shared secret is worse than none. */
export const MIN_TOKEN_LENGTH = 24;

const digest = (value: string): Buffer => createHash("sha256").update(value).digest();

/**
 * Checks `Authorization: Bearer <token>` against the configured token in constant time.
 * Fails closed: with no (or a weak) token configured every request is `disabled`, which the
 * routes answer as a plain 404 so the endpoints do not even advertise themselves.
 */
export function checkBearer(header: string | null, token: string | undefined): BearerResult {
  if (!token || token.length < MIN_TOKEN_LENGTH) return "disabled";
  const presented = /^Bearer\s+(\S+)$/i.exec(header ?? "")?.[1];
  if (!presented) return "unauthorized";
  return timingSafeEqual(digest(presented), digest(token)) ? "ok" : "unauthorized";
}
