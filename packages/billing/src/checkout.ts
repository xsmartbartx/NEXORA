import { getStripeClient } from "./stripe-client";

export interface CreateCheckoutSessionInput {
  orgId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
}

/**
 * Creates a Stripe-hosted Checkout Session and returns its URL — the
 * caller redirects the browser there (see apps/console/src/app/billing).
 * `subscription_data.metadata` is what lets the webhook (webhook.ts) find
 * its way back to the right organisation: Stripe copies it onto the
 * Subscription object it creates, so `customer.subscription.*` events
 * carry `orgId` without a separate lookup.
 */
export async function createCheckoutSession(input: CreateCheckoutSessionInput): Promise<string> {
  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: input.priceId, quantity: 1 }],
    subscription_data: { metadata: { orgId: input.orgId } },
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
  });

  if (!session.url) {
    throw new Error("Stripe did not return a Checkout Session URL.");
  }
  return session.url;
}
