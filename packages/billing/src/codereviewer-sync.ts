import { createHmac } from "node:crypto";

export type CodeReviewerPlanId = "free" | "pro" | "team";

/**
 * Core owns the CodeReviewer subscription of an organisation; CodeReviewer
 * enforces review quotas from its own database (ADR-0015, phase 2). After Core
 * records a subscription change it tells CodeReviewer the resulting plan, the
 * same way it tells Vigilo (`vigilo-sync.ts`), with its own secret so either
 * sync can be rotated or switched off alone. Same access rule as Core's own
 * entitlements: only `active` and `trialing` are paid.
 */
export function codereviewerPlanFor(tier: string, status: string): CodeReviewerPlanId {
  if (status !== "active" && status !== "trialing") return "free";
  return tier === "pro" || tier === "team" ? tier : "free";
}

/**
 * `HMAC-SHA256(secret, "<prefix><unix-seconds>.<body>")`, hex. Plan updates use
 * no prefix and link grants `link.`, so one can never be replayed as the other.
 */
export function signCodeReviewer(
  secret: string,
  timestamp: number,
  body: string,
  prefix: "" | "link." = "",
): string {
  return createHmac("sha256", secret).update(`${prefix}${timestamp}.${body}`).digest("hex");
}

export function codereviewerUrl(): string {
  return (process.env.CODEREVIEWER_URL || "https://codereviewer.onenexora.com").replace(/\/$/, "");
}

export function isCodeReviewerSyncConfigured(): boolean {
  return Boolean(process.env.CODEREVIEWER_SYNC_SECRET);
}

/**
 * Pushes one organisation's CodeReviewer plan. `asOf` is the Stripe event's
 * `created` time: Stripe does not deliver events in order, so CodeReviewer
 * ignores an update older than the one it has. A no-op (`"skipped"`) while no
 * secret is configured. Any other failure throws, so the Stripe webhook answers
 * non-2xx and Stripe redelivers; the update is idempotent.
 */
export async function syncCodeReviewerPlan(
  input: { orgId: string; planId: CodeReviewerPlanId; asOf: number },
  options: { fetchImpl?: typeof fetch; now?: () => number } = {},
): Promise<"synced" | "skipped"> {
  const secret = process.env.CODEREVIEWER_SYNC_SECRET;
  if (!secret) return "skipped";
  const url = `${codereviewerUrl()}/api/internal/org-plan`;
  if (new URL(url).protocol !== "https:" && process.env.NODE_ENV === "production") {
    throw new Error("CodeReviewer sync URL must be https");
  }

  const body = JSON.stringify({
    clerk_org_id: input.orgId,
    plan_id: input.planId,
    as_of: input.asOf,
  });
  const timestamp = Math.floor((options.now ?? Date.now)() / 1000);
  const response = await (options.fetchImpl ?? fetch)(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Nexora-Timestamp": String(timestamp),
      "X-Nexora-Signature": signCodeReviewer(secret, timestamp, body),
    },
    body,
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`CodeReviewer plan sync failed with HTTP ${response.status}`);
  return "synced";
}

export interface CodeReviewerLinkGrant {
  orgId: string;
  orgName: string;
  accountId: string;
  nonce: string;
  planId: CodeReviewerPlanId;
}

/**
 * The URL that hands an organisation admin's consent back to CodeReviewer, which
 * links the GitHub account only if the nonce matches the request that browser
 * started there (see CodeReviewer's src/lib/nexora/link.ts). The destination is
 * the configured CodeReviewer origin, never a caller-supplied URL.
 */
export function codereviewerLinkUrl(
  grant: CodeReviewerLinkGrant,
  now: number = Date.now(),
): string {
  const secret = process.env.CODEREVIEWER_SYNC_SECRET;
  if (!secret) throw new Error("CodeReviewer linking is not configured.");
  const body = JSON.stringify({
    org_id: grant.orgId,
    org_name: grant.orgName,
    account_id: grant.accountId,
    nonce: grant.nonce,
    plan_id: grant.planId,
  });
  const timestamp = Math.floor(now / 1000);
  const params = new URLSearchParams({
    grant: Buffer.from(body).toString("base64url"),
    ts: String(timestamp),
    sig: signCodeReviewer(secret, timestamp, body, "link."),
  });
  return `${codereviewerUrl()}/api/nexora/link/complete?${params}`;
}
