import { and, count, desc, eq, gte } from "drizzle-orm";
import { auditEvents, db, type AuditEvent } from "@nexora/database";

export interface LogEventInput {
  orgId: string;
  actorId: string;
  /** `<domain>.<object>.<action>` per Appendix A, e.g. "sentinel.scan.completed". */
  action: string;
  resourceType?: string;
  resourceId?: string;
  outcome?: "success" | "failure";
  metadata?: Record<string, unknown>;
}

/** C-EVENT: the one path products use to report usage and audit events to Core (§4.2). */
export async function logEvent(input: LogEventInput): Promise<void> {
  await db.insert(auditEvents).values({
    orgId: input.orgId,
    actorId: input.actorId,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    outcome: input.outcome ?? "success",
    metadata: input.metadata,
  });
}

/**
 * Org-scoped read, for Console's Usage view. Scoped by `orgId` at the query
 * itself — not filtered client-side after a broader fetch — per §12.3's
 * tenant-isolation rule.
 */
export async function listOrgEvents(orgId: string, limit = 50): Promise<AuditEvent[]> {
  return db
    .select()
    .from(auditEvents)
    .where(eq(auditEvents.orgId, orgId))
    .orderBy(desc(auditEvents.createdAt))
    .limit(limit);
}

/**
 * Powers Entitlements' metered limits (packages/entitlements): how many
 * times has this org logged `action` since `since`. Org-scoped at the
 * query itself, same isolation guarantee as `listOrgEvents`.
 */
export async function countOrgEvents(orgId: string, action: string, since: Date): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(auditEvents)
    .where(
      and(eq(auditEvents.orgId, orgId), eq(auditEvents.action, action), gte(auditEvents.createdAt, since)),
    );
  return row?.value ?? 0;
}

/** The start of the current calendar month, UTC — the metering window until a subscription's own billing-period dates are wired through. */
export function startOfCurrentBillingPeriod(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}
