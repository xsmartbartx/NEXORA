import { and, eq } from "drizzle-orm";
import { db, productSuspensions, subscriptions, type Subscription } from "@nexora/database";

/**
 * What NeuraWall (an independently hosted product, like Vigilo) needs from
 * Core: the plan this organisation is on. NeuraWall owns its own limits; Core
 * only answers "which plan". The plan catalog for NeuraWall is not part of
 * `PLAN_CATALOG` yet (that arrives with its Stripe prices), so this reads the
 * `subscriptions` row for product "neurawall" directly and trusts only the
 * known plan ids.
 */
export const NEURAWALL_PRODUCT = "neurawall";
export const NEURAWALL_PLAN_IDS = ["community", "pro", "business", "enterprise"] as const;
export type NeurawallPlanId = (typeof NEURAWALL_PLAN_IDS)[number];

const ACTIVE_STATUSES = new Set(["active", "trialing"]);

export interface NeurawallEntitlement {
  org_id: string;
  plan_id: NeurawallPlanId;
  /** Epoch seconds, or null when there is no paid period (Community). */
  current_period_end: number | null;
}

/**
 * Pure decision (same rule as `resolvePlanForSubscription`, so Core's own and
 * NeuraWall's idea of "paid" cannot drift): no row, a row that is not
 * active/trialing, an unknown plan id, or a suspended product all mean
 * Community. Community keeps a firewall running; it only removes paid extras.
 */
export function resolveNeurawallEntitlement(
  orgId: string,
  subscription: Pick<Subscription, "planId" | "status" | "currentPeriodEnd"> | null,
  suspended = false,
): NeurawallEntitlement {
  const community: NeurawallEntitlement = {
    org_id: orgId,
    plan_id: "community",
    current_period_end: null,
  };
  if (suspended || !subscription || !ACTIVE_STATUSES.has(subscription.status)) return community;
  const planId = NEURAWALL_PLAN_IDS.find((id) => id === subscription.planId);
  if (!planId || planId === "community") return community;
  return {
    org_id: orgId,
    plan_id: planId,
    current_period_end: subscription.currentPeriodEnd
      ? Math.floor(subscription.currentPeriodEnd.getTime() / 1000)
      : null,
  };
}

export async function getNeurawallEntitlement(orgId: string): Promise<NeurawallEntitlement> {
  const [row] = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.orgId, orgId), eq(subscriptions.product, NEURAWALL_PRODUCT)))
    .limit(1);
  const [suspension] = await db
    .select({ id: productSuspensions.id })
    .from(productSuspensions)
    .where(
      and(eq(productSuspensions.orgId, orgId), eq(productSuspensions.product, NEURAWALL_PRODUCT)),
    )
    .limit(1);
  return resolveNeurawallEntitlement(orgId, row ?? null, Boolean(suspension));
}
