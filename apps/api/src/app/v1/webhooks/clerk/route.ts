import { NextResponse } from "next/server";
import { verifyWebhook } from "@clerk/backend/webhooks";
import { purgeOrganizationData, purgeUserData } from "@nexora/billing";
import { apiError } from "@nexora/api-kit";

/**
 * Clerk calls this when an organisation or user is deleted, so their data
 * here is deleted too (privacy policy §4). Trust is Clerk's Svix signature
 * alone, checked against CLERK_WEBHOOK_SIGNING_SECRET.
 */
export async function POST(request: Request) {
  if (!process.env.CLERK_WEBHOOK_SIGNING_SECRET) {
    return apiError(
      503,
      "webhooks_not_configured",
      "CLERK_WEBHOOK_SIGNING_SECRET is not set — this deploy cannot process Clerk webhooks yet.",
    );
  }

  let event;
  try {
    event = await verifyWebhook(request);
  } catch {
    return apiError(401, "invalid_signature", "Webhook signature verification failed.");
  }

  // Non-2xx makes Clerk retry, which is what we want if Stripe or the database is briefly down.
  if (event.type === "organization.deleted" && event.data.id) {
    await purgeOrganizationData(event.data.id);
  } else if (event.type === "user.deleted" && event.data.id) {
    await purgeUserData(event.data.id);
  }

  return NextResponse.json({ received: true });
}
