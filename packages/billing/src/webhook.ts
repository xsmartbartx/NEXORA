import Stripe from "stripe";
import { and, eq } from "drizzle-orm";
import { db, subscriptions } from "@nexora/database";
import { PLANS, type ProductId } from "./plans";

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

/**
 * Which product+tier a Stripe price id belongs to — the plan catalog itself
 * is the source of truth, not anything Stripe tells us about the price.
 * `undefined` for a price this account doesn't recognise (e.g. a leftover
 * archived price, or one from Vigilo's shared use of the same account).
 */
function planForStripePrice(stripePriceId: string | undefined): (typeof PLANS)[number] | undefined {
  if (!stripePriceId) return undefined;
  return PLANS.find((plan) => Object.values(plan.stripePriceIds).includes(stripePriceId));
}

/**
 * The one writer to `subscriptions` (§4.1: Billing feeds Entitlements, it
 * doesn't decide access itself — this function is where that feed lands).
 * One row per (organisation, product): a resubscribe after cancellation
 * updates the same row rather than creating a second one, keyed by
 * `(orgId, product)` — not by Stripe's subscription id, which changes
 * across a cancel/resubscribe.
 *
 * A single Stripe Subscription can hold more than one item — a bundle
 * checkout (checkout.ts's `createBundleCheckoutSession`) puts every
 * product's price on one subscription so they bill and discount together —
 * so this writes one row per item, not one per event. Each item's product
 * is resolved by matching its price id against the plan catalog rather than
 * trusting subscription-level metadata, which couldn't disambiguate more
 * than one product on the same subscription anyway.
 *
 * `orgId` still travels via the subscription's own `metadata` (set at
 * Checkout Session creation, see checkout.ts) — Stripe has no concept of it
 * on its own.
 */
export async function applySubscriptionEvent(event: StripeEvent): Promise<void> {
  if (!event.type.startsWith("customer.subscription.")) return;

  const subscription = event.data.object as Stripe.Subscription;
  // The Stripe account is shared with Vigilo, whose subscriptions carry
  // `vigilo_account_email` instead of `orgId` — not ours to apply. Ignore
  // rather than error: a non-2xx makes Stripe retry for days and then
  // disable this endpoint for every product.
  const orgId = subscription.metadata?.orgId;
  if (!orgId) return;

  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;

  for (const item of subscription.items.data) {
    const plan = planForStripePrice(item.price.id);
    if (!plan) continue; // Not one of our products' prices — nothing to record.
    const product: ProductId = plan.product;

    const values = {
      orgId,
      product,
      planId: plan.id,
      status: subscription.status,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: customerId,
      currentPeriodEnd: new Date(item.current_period_end * 1000),
      updatedAt: new Date(),
    };

    const [existing] = await db
      .select({ id: subscriptions.id })
      .from(subscriptions)
      .where(and(eq(subscriptions.orgId, orgId), eq(subscriptions.product, product)))
      .limit(1);

    if (existing) {
      await db
        .update(subscriptions)
        .set(values)
        .where(and(eq(subscriptions.orgId, orgId), eq(subscriptions.product, product)));
    } else if (event.type !== "customer.subscription.deleted") {
      // A deletion for an org+product with no row means the org itself was
      // deleted (purgeOrganizationData cancels the subscription, then Stripe
      // notifies us) — re-inserting it would resurrect the purged org's
      // billing state.
      await db.insert(subscriptions).values(values);
    }
  }
}
