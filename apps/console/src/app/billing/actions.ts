"use server";

import { redirect } from "next/navigation";
import { requireOrg } from "@nexora/auth/server";
import {
  createBundleCheckoutSession,
  createCheckoutSession,
  createPortalSession,
  getOrgStripeCustomerId,
  getPlan,
  isBundleProductId,
  isProductId,
  type BundleCheckoutItem,
  type NativeProductId,
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

function couponIdForProductCount(count: number): string | null {
  if (count === 2) return process.env.STRIPE_COUPON_BUNDLE_2 || null;
  if (count === 3) return process.env.STRIPE_COUPON_BUNDLE_3 || null;
  return null;
}

/**
 * The Bundle Builder's checkout (apps/website's /bundles page links here
 * with `items` already chosen). One Checkout Session, one Stripe
 * Subscription with every selected product's price as a line item, one
 * Coupon for the combined discount (see `bundleDiscountPercent`) — the
 * webhook (packages/billing/src/webhook.ts) splits the resulting
 * subscription back into one `subscriptions` row per product.
 */
export async function startBundleCheckout(formData: FormData): Promise<void> {
  const { orgId } = await requireOrg();

  const itemsRaw = formData.get("items");
  if (typeof itemsRaw !== "string") throw new Error("Missing bundle items.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(itemsRaw);
  } catch {
    throw new Error("Malformed bundle items.");
  }
  if (!Array.isArray(parsed) || parsed.length < 2) {
    throw new Error("A bundle needs at least two products.");
  }

  const interval = formData.get("interval") === "year" ? "year" : "month";

  // Re-resolve every price from the plan catalog server-side — same
  // tamper-proofing as the single-product checkout above, just for each
  // item instead of one.
  const items: BundleCheckoutItem[] = parsed.map((entry) => {
    if (
      typeof entry !== "object" ||
      entry === null ||
      !("product" in entry) ||
      !("tier" in entry) ||
      typeof entry.product !== "string" ||
      typeof entry.tier !== "string" ||
      !isBundleProductId(entry.product)
    ) {
      throw new Error("Malformed bundle item.");
    }
    const product: NativeProductId = entry.product;
    const priceId = getPlan(product, entry.tier).stripePriceIds[interval];
    if (!priceId) {
      throw new Error(`No Stripe price configured for ${product} ${entry.tier} (${interval}).`);
    }
    return { product, priceId };
  });

  const distinctProducts = new Set(items.map((item) => item.product));
  if (distinctProducts.size !== items.length) {
    throw new Error("Each product can only appear once in a bundle.");
  }

  const couponId = couponIdForProductCount(items.length);
  const existingStripeCustomerId = await getOrgStripeCustomerId(orgId);

  const url = await createBundleCheckoutSession({
    orgId,
    items,
    couponId,
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
