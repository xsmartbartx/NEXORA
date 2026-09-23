import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db, subscriptions } from "@nexora/database";
import { DEFAULT_PLAN_ID, PLANS } from "./plans";

export interface SignatureVerifyResult {
  ok: boolean;
  reason?: string;
}

/**
 * Paddle's documented verification: the `Paddle-Signature` header is
 * `ts=<unix>;h1=<hex hmac>`, computed over `${ts}:${rawBody}` with the
 * webhook's own secret. Must run on the *raw* request body — anything that
 * re-serializes JSON (even with identical content) breaks the signature.
 */
export function verifyPaddleSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): SignatureVerifyResult {
  if (!signatureHeader) return { ok: false, reason: "missing_signature_header" };

  const parts = Object.fromEntries(
    signatureHeader.split(";").map((part) => part.split("=") as [string, string]),
  );
  const ts = parts.ts;
  const h1 = parts.h1;
  if (!ts || !h1) return { ok: false, reason: "malformed_signature_header" };

  const computed = crypto.createHmac("sha256", secret).update(`${ts}:${rawBody}`).digest("hex");

  const computedBuf = Buffer.from(computed, "hex");
  const givenBuf = Buffer.from(h1, "hex");
  if (computedBuf.length !== givenBuf.length || !crypto.timingSafeEqual(computedBuf, givenBuf)) {
    return { ok: false, reason: "signature_mismatch" };
  }
  return { ok: true };
}

export interface PaddleSubscriptionEventData {
  id: string;
  status: string;
  customer_id: string;
  custom_data: Record<string, unknown> | null;
  items: { price: { id: string } }[];
  current_billing_period?: { ends_at: string } | null;
}

export interface PaddleWebhookEvent {
  event_type: string;
  data: PaddleSubscriptionEventData;
}

function planIdForPaddlePrice(paddlePriceId: string | undefined): string {
  if (!paddlePriceId) return DEFAULT_PLAN_ID;
  return PLANS.find((plan) => plan.paddlePriceId === paddlePriceId)?.id ?? DEFAULT_PLAN_ID;
}

/**
 * The one writer to `subscriptions` (§4.1: Billing feeds Entitlements, it
 * doesn't decide access itself — this function is where that feed lands).
 * One row per organisation: a resubscribe after cancellation updates the
 * same row rather than creating a second one, keyed by `orgId` — not by
 * Paddle's subscription id, which changes across a cancel/resubscribe.
 */
export async function applySubscriptionEvent(event: PaddleWebhookEvent): Promise<void> {
  const { data } = event;
  const orgId = typeof data.custom_data?.orgId === "string" ? data.custom_data.orgId : null;
  if (!orgId) {
    throw new Error(
      "Subscription webhook has no orgId in custom_data — Console's checkout must pass it.",
    );
  }

  const planId = planIdForPaddlePrice(data.items[0]?.price.id);

  const values = {
    orgId,
    planId,
    status: data.status,
    paddleSubscriptionId: data.id,
    paddleCustomerId: data.customer_id,
    currentPeriodEnd: data.current_billing_period
      ? new Date(data.current_billing_period.ends_at)
      : null,
    updatedAt: new Date(),
  };

  const [existing] = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(eq(subscriptions.orgId, orgId))
    .limit(1);

  if (existing) {
    await db.update(subscriptions).set(values).where(eq(subscriptions.orgId, orgId));
  } else {
    await db.insert(subscriptions).values(values);
  }
}
