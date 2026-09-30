import Stripe from "stripe";
import { and, eq, isNull } from "drizzle-orm";
import { apiKeys, auditEvents, db, productSuspensions, subscriptions } from "@nexora/database";
import { getStripeClient, isStripeConfigured } from "./stripe-client";

const ENDED_STATUSES = new Set(["canceled", "incomplete_expired"]);

/**
 * Deletes everything NEXORA stores for an organisation (privacy policy §4:
 * "deleted within 30 days" of closure). Idempotent — safe to run again on a
 * retried webhook. Invoices stay in Stripe, which keeps them under its own
 * terms, so tax-retention obligations don't depend on our rows.
 *
 * Every one of the organisation's Stripe subscriptions is cancelled first
 * (Sentinel, CSPM and Gateway bill independently — packages/billing/src/plans.ts —
 * so an org can have more than one): deleting our rows without that would
 * leave a closed organisation being billed with nothing to show for it.
 */
export async function purgeOrganizationData(orgId: string): Promise<void> {
  const orgSubscriptions = await db
    .select({
      stripeSubscriptionId: subscriptions.stripeSubscriptionId,
      status: subscriptions.status,
    })
    .from(subscriptions)
    .where(eq(subscriptions.orgId, orgId));

  const active = orgSubscriptions.filter((s) => !ENDED_STATUSES.has(s.status));
  if (active.length > 0) {
    if (!isStripeConfigured()) {
      throw new Error(
        "Cannot cancel the organisation's Stripe subscription(s): Stripe is not configured.",
      );
    }
    for (const subscription of active) {
      try {
        await getStripeClient().subscriptions.cancel(subscription.stripeSubscriptionId);
      } catch (err) {
        const alreadyGone =
          err instanceof Stripe.errors.StripeInvalidRequestError && err.code === "resource_missing";
        if (!alreadyGone) throw err;
      }
    }
  }

  await db.transaction(async (tx) => {
    await tx.delete(apiKeys).where(eq(apiKeys.orgId, orgId));
    await tx.delete(productSuspensions).where(eq(productSuspensions.orgId, orgId));
    await tx.delete(auditEvents).where(eq(auditEvents.orgId, orgId));
    await tx.delete(subscriptions).where(eq(subscriptions.orgId, orgId));
  });
}

/** Deletes a user's own audit events that aren't part of any organisation's record. */
export async function purgeUserData(userId: string): Promise<void> {
  await db
    .delete(auditEvents)
    .where(and(eq(auditEvents.actorId, userId), isNull(auditEvents.orgId)));
}
