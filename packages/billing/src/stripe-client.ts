import Stripe from "stripe";

/** `STRIPE_SECRET_KEY` is only needed where a Checkout Session is created (Console) — never by the webhook route, which verifies with `STRIPE_WEBHOOK_SECRET` alone via `Stripe.webhooks` (a static method, no client instance required). */
export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.startsWith("sk_"));
}

let client: Stripe | null = null;

/** Lazily constructed so importing this module never throws when the key is a placeholder — callers check `isStripeConfigured()` first and degrade gracefully, same as every other Core integration in this repo. */
export function getStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not set.");
  }
  if (!client) {
    client = new Stripe(secretKey);
  }
  return client;
}
