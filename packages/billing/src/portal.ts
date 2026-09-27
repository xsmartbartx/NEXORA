import { getStripeClient } from "./stripe-client";

/**
 * A Stripe-hosted Customer Portal session: cancel (at period end, per the
 * portal configuration), update the card, download invoices. Returns the
 * URL the caller redirects to. `STRIPE_PORTAL_CONFIGURATION_ID` selects a
 * specific configuration; Stripe's default is used when it's unset.
 */
export async function createPortalSession(input: {
  customerId: string;
  returnUrl: string;
}): Promise<string> {
  const stripe = getStripeClient();
  const configuration = process.env.STRIPE_PORTAL_CONFIGURATION_ID || undefined;
  const session = await stripe.billingPortal.sessions.create({
    customer: input.customerId,
    return_url: input.returnUrl,
    ...(configuration ? { configuration } : {}),
  });
  return session.url;
}
