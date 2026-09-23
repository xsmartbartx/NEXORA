import { eq } from "drizzle-orm";
import { db, subscriptions, type Subscription } from "@nexora/database";
import { DEFAULT_PLAN_ID, getPlan, type Plan } from "./plans";

/**
 * No row, or a row that isn't `active`/`trialing`, means the free plan —
 * that's the point of `DEFAULT_PLAN_ID` rather than requiring every
 * organisation to have a subscription row from day one.
 */
const ACTIVE_STATUSES = new Set(["active", "trialing"]);

export async function getOrgPlan(orgId: string): Promise<Plan> {
  const [row] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.orgId, orgId))
    .limit(1);

  if (!row || !ACTIVE_STATUSES.has(row.status)) {
    return getPlan(DEFAULT_PLAN_ID);
  }
  return getPlan(row.planId);
}

export async function getOrgSubscription(orgId: string): Promise<Subscription | null> {
  const [row] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.orgId, orgId))
    .limit(1);
  return row ?? null;
}
