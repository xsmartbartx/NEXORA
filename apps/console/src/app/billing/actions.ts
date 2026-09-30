"use server";

import { redirect } from "next/navigation";
import { requireOrg } from "@nexora/auth/server";
import {
  createCheckoutSession,
  createPortalSession,
  getOrgStripeCustomerId,
  getPlan,
  isProductId,
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
  const productRaw = formData.get("product");
  if (typeof productRaw !== "string" || !isProductId(productRaw)) {
    throw new Error(`Unknown product: ${String(productRaw)}`);
  }
  const product = productRaw;

  const tierRaw = formData.get("tier");
  if (typeof tierRaw !== "string") throw new Error("Missing plan tier.");

  // The browser only chooses the interval and tier; the price itself comes
  // from the plan catalog, so a tampered form can't check out on some other
  // price in the Stripe account.
  const interval = formData.get("interval") === "year" ? "year" : "month";
  const priceId = getPlan(product, tierRaw).stripePriceIds[interval];
  if (!priceId)
    throw new Error(`No Stripe price configured for ${product} ${tierRaw} (${interval}).`);

  const existingStripeCustomerId = await getOrgStripeCustomerId(orgId);

  const url = await createCheckoutSession({
    orgId,
    product,
    priceId,
    existingStripeCustomerId,
    successUrl: `${consoleUrl}/billing?checkout=success`,
    cancelUrl: `${consoleUrl}/billing?checkout=cancelled`,
  });

  redirect(url);
}

/**
 * Opens Stripe's Customer Portal for the active organisation — one Stripe
 * Customer across every product it subscribes to (Sentinel, CSPM and
 * Gateway bill independently but share a Customer, see checkout.ts), so the
 * portal itself lists and manages all of them. Org admins only: the
 * subscription belongs to the whole organisation, so a regular member
 * mustn't be able to cancel it.
 */
export async function openBillingPortal(): Promise<void> {
  const { orgId, orgRole } = await requireOrg();
  if (orgRole !== "org:admin") {
    throw new Error("Only organisation admins can manage the subscription.");
  }
  const customerId = await getOrgStripeCustomerId(orgId);
  if (!customerId) {
    throw new Error("This organisation has no subscription to manage.");
  }

  const url = await createPortalSession({
    customerId,
    returnUrl: `${consoleUrl}/billing`,
  });

  redirect(url);
}
