"use server";

import { redirect } from "next/navigation";
import { requireOrg } from "@nexora/auth/server";
import { createCheckoutSession, getPlan } from "@nexora/billing";

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
