import { eq } from "drizzle-orm";
import { db, subscriptions, type Subscription } from "@nexora/database";
import { DEFAULT_PLAN_ID, getPlan, type Plan } from "./plans";

/**
 * No row, or a row that isn't `active`/`trialing`, means the free plan —
 * that's the point of `DEFAULT_PLAN_ID` rather than requiring every
 * organisation to have a subscription row from day one.
 */
const ACTIVE_STATUSES = new Set(["active", "trialing"]);

/**
 * Pure decision, split out from `getOrgPlan` so a caller that already has
 * the subscription row (e.g. `@nexora/admin`'s customer list, which loads
 * every org's row in one query rather than one-by-one) can resolve the
 * plan without a second database round trip per organisation.
 */
export function resolvePlanForSubscription(subscription: Subscription | null): Plan {
  if (!subscription || !ACTIVE_STATUSES.has(subscription.status)) {
    return getPlan(DEFAULT_PLAN_ID);
  }
  return getPlan(subscription.planId);
}

export async function getOrgPlan(orgId: string): Promise<Plan> {
  const [row] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.orgId, orgId))
    .limit(1);
  return resolvePlanForSubscription(row ?? null);
}

export async function getOrgSubscription(orgId: string): Promise<Subscription | null> {
  const [row] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.orgId, orgId))
    .limit(1);
  return row ?? null;
}
