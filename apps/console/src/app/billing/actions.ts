"use server";

import { redirect } from "next/navigation";
import { requireOrg } from "@nexora/auth/server";
import { createCheckoutSession } from "@nexora/billing";

const consoleUrl = process.env.NEXT_PUBLIC_CONSOLE_URL ?? "http://localhost:3002";

/**
 * A plain form action, not a client-side SDK flow — Stripe Checkout is
 * hosted, so all we need is to create the Session server-side and send the
 * browser to its URL. Simpler than Paddle's client-side overlay, and keeps
 * the Stripe secret key out of the browser entirely.
 */
export async function startCheckout(formData: FormData): Promise<void> {
  const { orgId } = await requireOrg();
  const priceId = String(formData.get("priceId") ?? "");
  if (!priceId) throw new Error("Missing priceId.");

  const url = await createCheckoutSession({
    orgId,
    priceId,
    successUrl: `${consoleUrl}/billing?checkout=success`,
    cancelUrl: `${consoleUrl}/billing?checkout=cancelled`,
  });

  redirect(url);
}
