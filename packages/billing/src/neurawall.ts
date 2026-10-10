import { and, eq } from "drizzle-orm";
import { db, productSuspensions, subscriptions, type Subscription } from "@nexora/database";
import { resolvePlanForSubscription } from "./subscription";

/**
 * What a linked NeuraWall installation needs from Core: the plan this
 * organisation is on. NeuraWall enforces its own limits; Core only answers
 * "which plan". The plan comes from the catalog (`PLAN_CATALOG.neurawall`) and
 * the same rule as every other product (`resolvePlanForSubscription`), so
 * Core's and NeuraWall's idea of "paid" cannot drift. On the wire the catalog's
 * "free" tier is NeuraWall's "community".
 */
export const NEURAWALL_PRODUCT = "neurawall";
export const NEURAWALL_PLAN_IDS = ["community", "pro", "business", "enterprise"] as const;
export type NeurawallPlanId = (typeof NEURAWALL_PLAN_IDS)[number];

export interface NeurawallEntitlement {
  org_id: string;
  plan_id: NeurawallPlanId;
  /** Epoch seconds, or null when there is no paid period (Community). */
  current_period_end: number | null;
}

/**
 * Pure decision. No row, a row that is not active/trialing, an unknown plan id,
 * or a suspended product all mean Community. Community keeps a firewall
 * running; it only removes paid extras.
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
  if (suspended) return community;
  const plan = resolvePlanForSubscription(subscription, NEURAWALL_PRODUCT);
  const planId = NEURAWALL_PLAN_IDS.find((id) => id === plan.id);
  if (!planId || !subscription) return community; // "free" is not a wire id: it is Community
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
