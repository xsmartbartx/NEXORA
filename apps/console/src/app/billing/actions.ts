"use server";

import { redirect } from "next/navigation";
import { requireOrg } from "@nexora/auth/server";
import {
  createCheckoutSession,
  createPortalSession,
  getOrgSubscription,
  getPlan,
} from "@nexora/billing";

const consoleUrl = process.env.NEXT_PUBLIC_CONSOLE_URL ?? "http://localhost:3002";

/**
 * A plain form action, not a client-side SDK flow — Stripe Checkout is
 * hosted, so all we need is to create the Session server-side and send the
 * browser to its URL. Simpler than Paddle's client-side overlay, and keeps
 * the Stripe secret key out of the browser entirely.
 */
export async function startCheckout(formData: FormData): Promise<void> {
  const { orgId } = await requireOrg();
  // The browser only chooses the interval; the price itself comes from the
  // plan catalog, so a tampered form can't check out on some other price in
  // the Stripe account.
  const interval = formData.get("interval") === "year" ? "year" : "month";
  const priceId = getPlan("pro").stripePriceIds[interval];
  if (!priceId) throw new Error(`No Stripe price configured for Pro (${interval}).`);

  const url = await createCheckoutSession({
    orgId,
    priceId,
    successUrl: `${consoleUrl}/billing?checkout=success`,
    cancelUrl: `${consoleUrl}/billing?checkout=cancelled`,
  });

  redirect(url);
}

/**
 * Opens Stripe's Customer Portal for the active organisation's own
 * subscription — the customer id comes from our subscriptions row, never
 * the form. Org admins only: the subscription belongs to the whole
 * organisation, so a regular member mustn't be able to cancel it.
 */
export async function openBillingPortal(): Promise<void> {
  const { orgId, orgRole } = await requireOrg();
  if (orgRole !== "org:admin") {
    throw new Error("Only organisation admins can manage the subscription.");
  }
  const subscription = await getOrgSubscription(orgId);
  if (!subscription?.stripeCustomerId) {
    throw new Error("This organisation has no subscription to manage.");
  }

  const url = await createPortalSession({
    customerId: subscription.stripeCustomerId,
    returnUrl: `${consoleUrl}/billing`,
  });

  redirect(url);
}
