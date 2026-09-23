import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db, subscriptions } from "@nexora/database";
import { DEFAULT_PLAN_ID, PLANS } from "./plans";

/** Re-exported so consumers (the webhook route in apps/api) don't need their own `stripe` dependency just for this type. */
export type StripeEvent = Stripe.Event;

export interface SignatureVerifyResult {
  ok: boolean;
  reason?: string;
  event?: StripeEvent;
}

/**
 * `Stripe.webhooks` is a static method — it needs only the webhook signing
 * secret, never a full API client, so the webhook route (apps/api) doesn't
 * need `STRIPE_SECRET_KEY` at all. Uses Stripe's own verification rather
 * than a hand-rolled HMAC: it handles the documented `t=...,v1=...` header
 * format, replay-tolerance window and timing-safe comparison itself.
 */
export function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): SignatureVerifyResult {
  if (!signatureHeader) return { ok: false, reason: "missing_signature_header" };

  try {
    const event = Stripe.webhooks.constructEvent(rawBody, signatureHeader, secret);
    return { ok: true, event };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "signature_verification_failed";
    return { ok: false, reason };
  }
}

function planIdForStripePrice(stripePriceId: string | undefined): string {
  if (!stripePriceId) return DEFAULT_PLAN_ID;
  return PLANS.find((plan) => plan.stripePriceId === stripePriceId)?.id ?? DEFAULT_PLAN_ID;
}

/**
 * The one writer to `subscriptions` (§4.1: Billing feeds Entitlements, it
 * doesn't decide access itself — this function is where that feed lands).
 * One row per organisation: a resubscribe after cancellation updates the
 * same row rather than creating a second one, keyed by `orgId` — not by
 * Stripe's subscription id, which changes across a cancel/resubscribe.
 *
 * `orgId` travels via the subscription's own `metadata` (set at Checkout
 * Session creation through `subscription_data.metadata`, see checkout.ts) —
 * Stripe has no concept of a NEXORA org on its own.
 */
export async function applySubscriptionEvent(event: StripeEvent): Promise<void> {
  if (!event.type.startsWith("customer.subscription.")) return;

  const subscription = event.data.object as Stripe.Subscription;
  const orgId = subscription.metadata?.orgId;
  if (!orgId) {
    throw new Error(
      "Subscription webhook has no orgId in metadata — Console's checkout must pass it.",
    );
  }

  const item = subscription.items.data[0];
  const planId = planIdForStripePrice(item?.price.id);
  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;

  const values = {
    orgId,
    planId,
    status: subscription.status,
    stripeSubscriptionId: subscription.id,
    stripeCustomerId: customerId,
    currentPeriodEnd: item ? new Date(item.current_period_end * 1000) : null,
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
