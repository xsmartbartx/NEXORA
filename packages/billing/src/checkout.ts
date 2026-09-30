import { getStripeClient } from "./stripe-client";
import type { ProductId } from "./plans";

export interface CreateCheckoutSessionInput {
  orgId: string;
  product: ProductId;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  /** An existing Stripe Customer id for this org, if it already has one from another product's subscription — keeps every product on one Customer instead of Stripe creating a new one per checkout. */
  existingStripeCustomerId?: string | null;
}

/**
 * Creates a Stripe-hosted Checkout Session and returns its URL — the
 * caller redirects the browser there (see apps/console/src/app/billing).
 * `subscription_data.metadata` is what lets the webhook (webhook.ts) find
 * its way back to the right organisation and product: Stripe copies it onto
 * the Subscription object it creates, so `customer.subscription.*` events
 * carry both without a separate lookup. Sentinel, CSPM and Gateway are
 * billed independently (packages/billing/src/plans.ts), so a customer with
 * subscriptions to more than one product ends up with more than one Stripe
 * Subscription — `customer_email`/an existing `customer` id (looked up by
 * the caller, if any) keeps them on one Stripe Customer regardless.
 */
export async function createCheckoutSession(input: CreateCheckoutSessionInput): Promise<string> {
  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: input.priceId, quantity: 1 }],
    subscription_data: { metadata: { orgId: input.orgId, product: input.product } },
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    ...(input.existingStripeCustomerId ? { customer: input.existingStripeCustomerId } : {}),
  });

  if (!session.url) {
    throw new Error("Stripe did not return a Checkout Session URL.");
  }
  return session.url;
}

export interface BundleCheckoutItem {
  product: ProductId;
  priceId: string;
}

export interface CreateBundleCheckoutSessionInput {
  orgId: string;
  items: BundleCheckoutItem[];
  /** A live Stripe Coupon id for this bundle's product count (see `bundleDiscountPercent` in ./plans) — omitted for a 1-item "bundle", which is just a normal checkout. */
  couponId?: string | null;
  successUrl: string;
  cancelUrl: string;
  existingStripeCustomerId?: string | null;
}

/**
 * One Checkout Session, one resulting Stripe Subscription with several
 * items — a Stripe Subscription can only be created by one Session, so a
 * bundle of N products becomes N line items on a single subscription rather
 * than N separate ones. The webhook (webhook.ts) reads every item off that
 * one subscription and writes one `subscriptions` row per product, exactly
 * as if each had been bought separately — the coupon is the only thing that
 * makes this a "bundle" rather than N unrelated purchases.
 */
export async function createBundleCheckoutSession(
  input: CreateBundleCheckoutSessionInput,
): Promise<string> {
  if (input.items.length === 0) {
    throw new Error("A bundle checkout needs at least one item.");
  }
  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: input.items.map((item) => ({ price: item.priceId, quantity: 1 })),
    subscription_data: { metadata: { orgId: input.orgId } },
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    ...(input.couponId ? { discounts: [{ coupon: input.couponId }] } : {}),
    ...(input.existingStripeCustomerId ? { customer: input.existingStripeCustomerId } : {}),
  });

  if (!session.url) {
    throw new Error("Stripe did not return a Checkout Session URL.");
  }
  return session.url;
}
