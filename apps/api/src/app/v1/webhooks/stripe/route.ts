import { NextResponse } from "next/server";
import { applySubscriptionEvent, verifyStripeSignature } from "@nexora/billing";
import { apiError } from "@nexora/api-kit";

/**
 * Stripe calls this directly — no user session, no NEXORA API key. Trust
 * is the HMAC signature alone (§4.2's model of "every input is untrusted"
 * applies to Stripe's own calls too, not just customer traffic).
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signatureHeader = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    return apiError(
      503,
      "billing_not_configured",
      "STRIPE_WEBHOOK_SECRET is not set — this deploy cannot process billing webhooks yet.",
    );
  }

  const verification = verifyStripeSignature(rawBody, signatureHeader, secret);
  if (!verification.ok || !verification.event) {
    return apiError(
      401,
      "invalid_signature",
      `Webhook signature verification failed: ${verification.reason}`,
    );
  }

  try {
    await applySubscriptionEvent(verification.event);
  } catch (err) {
    // 400, not 500: a malformed/unassociable event won't succeed on retry either.
    const message =
      err instanceof Error ? err.message : "Unknown error processing subscription event.";
    return apiError(400, "webhook_processing_failed", message);
  }

  return NextResponse.json({ received: true });
}
