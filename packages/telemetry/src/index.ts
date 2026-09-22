import { desc, eq } from "drizzle-orm";
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
