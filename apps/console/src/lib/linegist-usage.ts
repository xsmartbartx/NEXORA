import { createHmac } from "node:crypto";

/**
 * Client for Linegist's read-only usage endpoint (contract: docs/console-contract.md in the Linegist
 * repo). Server-side only: it reads LINEGIST_SHARED_SECRET and must never reach a browser bundle.
 * The value is the same secret Linegist has as CONSOLE_SHARED_SECRET.
 */
export type LinegistUsage = {
  product: "linegist";
  period: string;
  plan: string;
  scansUsed: number;
  scansLimit: number;
};

export type LinegistUsageResult =
  | { status: "ok"; usage: LinegistUsage }
  | { status: "not_started" } // 404: the org has never opened Linegist
  | { status: "not_configured" } // no secret set here
  | { status: "unavailable" }; // timeout, 401, 5xx or an unreadable body

const DEFAULT_BASE = "https://linegist.onenexora.com";
const TTL_OK_MS = 60_000;
const TTL_FAIL_MS = 15_000;

/** Lowercase hex HMAC-SHA256 of "<unix seconds>.<org id>", exactly as the contract defines it. */
export function signLinegistRequest(secret: string, timestamp: number, org: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${org}`).digest("hex");
}

function parseUsage(body: unknown): LinegistUsage | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;
  if (
    b.product !== "linegist" ||
    typeof b.period !== "string" ||
    typeof b.plan !== "string" ||
    typeof b.scansUsed !== "number" ||
    typeof b.scansLimit !== "number"
  ) {
    return null;
  }
  // Unknown extra fields are ignored on purpose (additive changes within v1).
  return {
    product: "linegist",
    period: b.period,
    plan: b.plan,
    scansUsed: b.scansUsed,
    scansLimit: b.scansLimit,
  };
}

type Deps = {
  fetch?: typeof fetch;
  now?: () => number;
  env?: Record<string, string | undefined>;
};

const cache = new Map<string, { at: number; ttl: number; result: LinegistUsageResult }>();

export function clearLinegistUsageCache() {
  cache.clear();
}

export async function getLinegistUsage(
  orgId: string,
  deps: Deps = {},
): Promise<LinegistUsageResult> {
  const env = deps.env ?? process.env;
  const secret = env.LINEGIST_SHARED_SECRET;
  if (!secret) return { status: "not_configured" };

  const now = deps.now ?? Date.now;
  const hit = cache.get(orgId);
  if (hit && now() - hit.at < hit.ttl) return hit.result;

  const base = (env.LINEGIST_URL || DEFAULT_BASE).replace(/\/+$/, "");
  const ts = Math.floor(now() / 1000);
  const remember = (result: LinegistUsageResult, ttl: number) => {
    cache.set(orgId, { at: now(), ttl, result });
    return result;
  };

  try {
    const res = await (deps.fetch ?? fetch)(
      `${base}/api/internal/usage?org=${encodeURIComponent(orgId)}`,
      {
        headers: {
          "x-nexora-timestamp": String(ts),
          "x-nexora-signature": signLinegistRequest(secret, ts, orgId),
        },
        signal: AbortSignal.timeout(5000),
        cache: "no-store",
      },
    );
    if (res.status === 404) return remember({ status: "not_started" }, TTL_OK_MS);
    if (!res.ok) return remember({ status: "unavailable" }, TTL_FAIL_MS);
    const usage = parseUsage(await res.json());
    return usage
      ? remember({ status: "ok", usage }, TTL_OK_MS)
      : remember({ status: "unavailable" }, TTL_FAIL_MS);
  } catch {
    return remember({ status: "unavailable" }, TTL_FAIL_MS);
  }
}
