import { NextResponse } from "next/server";
import {
  applySubscriptionEvent,
  verifyPaddleSignature,
  type PaddleWebhookEvent,
} from "@nexora/billing";
import { apiError } from "@nexora/api-kit";

/**
 * Paddle calls this directly — no user session, no NEXORA API key. Trust
 * is the HMAC signature alone (§4.2's model of "every input is untrusted"
 * applies to Paddle's own calls too, not just customer traffic).
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signatureHeader = request.headers.get("paddle-signature");
  const secret = process.env.PADDLE_WEBHOOK_SECRET_KEY;

  if (!secret) {
    return apiError(
      503,
      "billing_not_configured",
      "PADDLE_WEBHOOK_SECRET_KEY is not set — this deploy cannot process billing webhooks yet.",
    );
  }

  const verification = verifyPaddleSignature(rawBody, signatureHeader, secret);
  if (!verification.ok) {
    return apiError(
      401,
      "invalid_signature",
      `Webhook signature verification failed: ${verification.reason}`,
    );
  }

  let event: PaddleWebhookEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return apiError(400, "invalid_payload", "Webhook body is not valid JSON.");
  }

  if (event.event_type?.startsWith("subscription.")) {
    try {
      await applySubscriptionEvent(event);
    } catch (err) {
      // 400, not 500: a malformed/unassociable event won't succeed on retry either.
      const message =
        err instanceof Error ? err.message : "Unknown error processing subscription event.";
      return apiError(400, "webhook_processing_failed", message);
    }
  }

  return NextResponse.json({ received: true });
}
