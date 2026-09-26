import { and, count, gte, inArray } from "drizzle-orm";
import { auditEvents, db } from "@nexora/database";

/** `orgId -> action -> count`. One grouped query for every org at once — the cross-org counterpart to `@nexora/telemetry`'s `countOrgEvents`, which is deliberately scoped to a single org and can't answer "usage for every customer" itself. */
export async function getUsageByOrg(
  actions: string[],
  since: Date,
): Promise<Map<string, Map<string, number>>> {
  const result = new Map<string, Map<string, number>>();
  if (actions.length === 0) return result;

  const rows = await db
    .select({ orgId: auditEvents.orgId, action: auditEvents.action, value: count() })
    .from(auditEvents)
    .where(and(inArray(auditEvents.action, actions), gte(auditEvents.createdAt, since)))
    .groupBy(auditEvents.orgId, auditEvents.action);

  for (const row of rows) {
    if (!row.orgId) continue;
    if (!result.has(row.orgId)) result.set(row.orgId, new Map());
    result.get(row.orgId)!.set(row.action, row.value);
  }
  return result;
}
