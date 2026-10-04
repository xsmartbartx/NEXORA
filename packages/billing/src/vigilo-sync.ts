import { createHmac } from "node:crypto";

export type VigiloPlanId = "free" | "pro";

/**
 * Core owns the Vigilo subscription; Vigilo enforces access from its own
 * database. After Core records a subscription change it tells Vigilo the
 * resulting plan for the organisation. Same access rule as Core's own
 * entitlements (`resolvePlanForSubscription`): only `active` and `trialing`
 * are paid, anything else (including `past_due`) is Free.
 */
export function vigiloPlanFor(status: string): VigiloPlanId {
  return status === "active" || status === "trialing" ? "pro" : "free";
}

/** `HMAC-SHA256(secret, "<unix-seconds>.<raw body>")`, hex. Vigilo recomputes it over the exact bytes it receives. */
export function signVigiloSync(secret: string, timestamp: number, body: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

export function isVigiloSyncConfigured(): boolean {
  return Boolean(process.env.NEXORA_SYNC_SECRET);
}

function endpoint(): string {
  const base = (process.env.VIGILO_API_URL || "https://vigilo-api.onenexora.com").replace(
    /\/$/,
    "",
  );
  return `${base}/v1/internal/org-plan`;
}

export type SyncResult = "synced" | "skipped";

/**
 * Pushes one organisation's Vigilo plan. A no-op (`"skipped"`) when no shared
 * secret is configured, so the integration stays off until deliberately
 * enabled. Any other failure throws: the Stripe webhook then answers non-2xx
 * and Stripe redelivers, and the sync (like the subscription upsert before it)
 * is idempotent.
 */
export async function syncVigiloPlan(
  input: { orgId: string; planId: VigiloPlanId },
  options: { fetchImpl?: typeof fetch; now?: () => number } = {},
): Promise<SyncResult> {
  const secret = process.env.NEXORA_SYNC_SECRET;
  if (!secret) return "skipped";
  const url = endpoint();
  if (new URL(url).protocol !== "https:" && process.env.NODE_ENV === "production") {
    throw new Error("Vigilo sync URL must be https");
  }

  const body = JSON.stringify({ clerk_org_id: input.orgId, plan_id: input.planId });
  const timestamp = Math.floor((options.now ?? Date.now)() / 1000);
  const response = await (options.fetchImpl ?? fetch)(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Nexora-Timestamp": String(timestamp),
      "X-Nexora-Signature": signVigiloSync(secret, timestamp, body),
    },
    body,
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Vigilo plan sync failed with HTTP ${response.status}`);
  return "synced";
}
