import { and, eq } from "drizzle-orm";
import { db, subscriptions, type Subscription } from "@nexora/database";
import { DEFAULT_TIER, getPlan, type Plan, type ProductId } from "./plans";

/**
 * No row, or a row that isn't `active`/`trialing`, means the free plan —
 * that's the point of `DEFAULT_TIER` rather than requiring every
 * organisation to have a subscription row from day one.
 */
const ACTIVE_STATUSES = new Set(["active", "trialing"]);

/**
 * Pure decision, split out from `getOrgPlan` so a caller that already has
 * the subscription row (e.g. `@nexora/admin`'s customer list, which loads
 * every org's rows in one query rather than one-by-one) can resolve the
 * plan without a second database round trip per organisation.
 */
export function resolvePlanForSubscription(
  subscription: Pick<Subscription, "planId" | "status"> | null,
  product: ProductId,
): Plan {
  if (!subscription || !ACTIVE_STATUSES.has(subscription.status)) {
    return getPlan(product, DEFAULT_TIER);
  }
  return getPlan(product, subscription.planId);
}

export async function getOrgPlan(orgId: string, product: ProductId): Promise<Plan> {
  const row = await getOrgSubscription(orgId, product);
  return resolvePlanForSubscription(row, product);
}

export async function getOrgSubscription(
  orgId: string,
  product: ProductId,
): Promise<Subscription | null> {
  const [row] = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.orgId, orgId), eq(subscriptions.product, product)))
    .limit(1);
  return row ?? null;
}

/** Every product this organisation has a subscription row for, active or not. */
export async function getOrgSubscriptions(orgId: string): Promise<Subscription[]> {
  return db.select().from(subscriptions).where(eq(subscriptions.orgId, orgId));
}

/**
 * The Stripe customer id to open a Customer Portal session with — one
 * customer per org across every product it subscribes to, so any existing
 * row's `stripeCustomerId` works; the portal itself lists all of that
 * customer's subscriptions.
 */
export async function getOrgStripeCustomerId(orgId: string): Promise<string | null> {
  const rows = await getOrgSubscriptions(orgId);
  return rows[0]?.stripeCustomerId ?? null;
}
