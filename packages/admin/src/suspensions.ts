import { and, eq } from "drizzle-orm";
import { db, productSuspensions } from "@nexora/database";
import { logEvent } from "@nexora/telemetry";
import { findControllableProduct } from "./customers";

export class UnknownProductError extends Error {
  constructor(product: string) {
    super(`"${product}" isn't a controllable product (no plan references it).`);
    this.name = "UnknownProductError";
  }
}

/**
 * Suspends a product for one organisation, independent of its plan
 * (§4.1: this is a second gate ahead of Entitlements' plan-limit check,
 * not a replacement for it). Idempotent — suspending an already-suspended
 * product just refreshes the reason/actor rather than erroring, since two
 * staff members racing to suspend the same thing for the same underlying
 * issue is a non-event, not a conflict.
 */
export async function suspendProduct(
  orgId: string,
  product: string,
  reason: string,
  actorId: string,
): Promise<void> {
  if (!findControllableProduct(product)) throw new UnknownProductError(product);
  if (!reason.trim()) throw new Error("A reason is required to suspend a product.");

  await db
    .insert(productSuspensions)
    .values({ orgId, product, reason: reason.trim(), suspendedBy: actorId })
    .onConflictDoUpdate({
      target: [productSuspensions.orgId, productSuspensions.product],
      set: { reason: reason.trim(), suspendedBy: actorId, createdAt: new Date() },
    });

  await logEvent({
    orgId,
    actorId,
    action: "admin.product_access.suspended",
    resourceType: "product",
    resourceId: product,
    metadata: { reason: reason.trim() },
  });
}

/** Resumes a suspended product. A no-op (still audit-logged) if it wasn't suspended — an admin double-clicking "resume" isn't an error case. */
export async function resumeProduct(orgId: string, product: string, actorId: string): Promise<void> {
  await db
    .delete(productSuspensions)
    .where(and(eq(productSuspensions.orgId, orgId), eq(productSuspensions.product, product)));

  await logEvent({
    orgId,
    actorId,
    action: "admin.product_access.resumed",
    resourceType: "product",
    resourceId: product,
  });
}
