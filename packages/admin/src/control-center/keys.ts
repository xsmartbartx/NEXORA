import { apiKeys, db } from "@nexora/database";
import { listCustomers, type CustomerSummary } from "../customers";

const DAY = 86_400_000;
export const STALE_AFTER_DAYS = 30;
export const NEVER_USED_AFTER_DAYS = 7;
export const QUOTA_WARN_RATIO = 0.8;

export interface KeyRow {
  orgId: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}

export interface KeyHygiene {
  active: number;
  /** Active keys created over a week ago that have never made a call. */
  neverUsed: number;
  /** Active keys last used more than 30 days ago. */
  stale: number;
  revokedLast30Days: number;
  organisations: number;
  /** Organisations holding the most active keys. */
  topOrgs: { orgId: string; active: number }[];
}

/** Pure, so the thresholds are tested rather than buried in a query. */
export function classifyKeys(rows: KeyRow[], now: Date = new Date()): KeyHygiene {
  const t = now.getTime();
  const perOrg = new Map<string, number>();
  let active = 0;
  let neverUsed = 0;
  let stale = 0;
  let revokedLast30Days = 0;

  for (const key of rows) {
    if (key.revokedAt) {
      if (t - key.revokedAt.getTime() <= 30 * DAY) revokedLast30Days++;
      continue;
    }
    active++;
    perOrg.set(key.orgId, (perOrg.get(key.orgId) ?? 0) + 1);
    if (key.lastUsedAt === null) {
      if (t - key.createdAt.getTime() > NEVER_USED_AFTER_DAYS * DAY) neverUsed++;
    } else if (t - key.lastUsedAt.getTime() > STALE_AFTER_DAYS * DAY) {
      stale++;
    }
  }

  return {
    active,
    neverUsed,
    stale,
    revokedLast30Days,
    organisations: perOrg.size,
    topOrgs: [...perOrg.entries()]
      .map(([orgId, n]) => ({ orgId, active: n }))
      .sort((a, b) => b.active - a.active)
      .slice(0, 5),
  };
}

export async function collectKeyHygiene(): Promise<KeyHygiene> {
  const rows = await db
    .select({
      orgId: apiKeys.orgId,
      createdAt: apiKeys.createdAt,
      lastUsedAt: apiKeys.lastUsedAt,
      revokedAt: apiKeys.revokedAt,
    })
    .from(apiKeys);
  return classifyKeys(rows);
}

export interface QuotaPressureRow {
  orgId: string;
  orgName: string;
  product: string;
  plan: string;
  used: number;
  limit: number;
  ratio: number;
}

/** Customers at or above `threshold` of a plan limit, fullest first: the upgrade conversations to have and the people about to hit a wall. Unlimited plans and suspended products can't be "near" a limit. */
export function quotaPressure(
  customers: CustomerSummary[],
  threshold: number = QUOTA_WARN_RATIO,
): QuotaPressureRow[] {
  const rows: QuotaPressureRow[] = [];
  for (const customer of customers) {
    for (const usage of customer.products) {
      if (usage.limit === null || usage.limit <= 0 || usage.suspended) continue;
      const ratio = usage.used / usage.limit;
      if (ratio < threshold) continue;
      rows.push({
        orgId: customer.orgId,
        orgName: customer.name,
        product: usage.product.name,
        plan: usage.plan.name,
        used: usage.used,
        limit: usage.limit,
        ratio,
      });
    }
  }
  return rows.sort((a, b) => b.ratio - a.ratio);
}

export async function collectQuotaPressure(): Promise<QuotaPressureRow[]> {
  return quotaPressure(await listCustomers());
}
