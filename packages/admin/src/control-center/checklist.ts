import { max } from "drizzle-orm";
import { auditEvents, db, opsChecklistCompletions } from "@nexora/database";

export type Cadence = "daily" | "weekly" | "monthly";

export interface ChecklistTask {
  id: string;
  cadence: Cadence;
  title: string;
  detail: string;
  /** Where to go do it. */
  href: string;
}

/**
 * The owner's recurring reviews. Hosting is Oracle Cloud, so cloud and cost
 * checks point at OCI; PostHog is deliberately absent until there's an
 * account to review.
 */
export const CHECKLIST: ChecklistTask[] = [
  {
    id: "daily-github",
    cadence: "daily",
    title: "GitHub",
    detail: "Open PRs, failing CI, new security alerts.",
    href: "https://github.com/xsmartbartx/NEXORA",
  },
  {
    id: "daily-cloud",
    cadence: "daily",
    title: "Oracle Cloud",
    detail: "Instance health, alarms, anything unexpected in the console.",
    href: "https://cloud.oracle.com",
  },
  {
    id: "daily-sentry",
    cadence: "daily",
    title: "Sentry",
    detail: "Triage new errors; resolve or assign.",
    href: "https://sentry.io",
  },
  {
    id: "daily-grafana",
    cadence: "daily",
    title: "Grafana",
    detail: "Dashboards look normal; no alerts firing.",
    href: "https://monitoring.onenexora.com",
  },
  {
    id: "weekly-ga4",
    cadence: "weekly",
    title: "Google Analytics",
    detail: "Visitors → signups → activation: where does the funnel leak?",
    href: "https://analytics.google.com",
  },
  {
    id: "weekly-search-console",
    cadence: "weekly",
    title: "Search Console",
    detail: "Clicks, impressions, indexing errors, Core Web Vitals.",
    href: "https://search.google.com/search-console?resource_id=sc-domain%3Aonenexora.com",
  },
  {
    id: "weekly-costs",
    cadence: "weekly",
    title: "Cloud cost analysis",
    detail: "Spend vs. last week; update the cost ledger below if it changed.",
    href: "https://cloud.oracle.com/account-management/cost-analysis",
  },
  {
    id: "weekly-security",
    cadence: "weekly",
    title: "Security findings",
    detail: "Dependabot and code-scanning alerts, TLS expiry, failed events.",
    href: "https://github.com/xsmartbartx/NEXORA/security",
  },
  {
    id: "monthly-billing",
    cadence: "monthly",
    title: "Billing statements",
    detail: "Oracle Cloud and Stripe invoices reconcile with the ledger.",
    href: "https://cloud.oracle.com/account-management/billing",
  },
  {
    id: "monthly-subscriptions",
    cadence: "monthly",
    title: "SaaS subscriptions",
    detail: "Every tool still earns its cost; cancel what doesn't.",
    href: "https://dashboard.stripe.com/settings/billing/automatic",
  },
  {
    id: "monthly-findings",
    cadence: "monthly",
    title: "Open security findings",
    detail: "Triage every open alert to fixed, dismissed with a reason, or ticketed.",
    href: "https://github.com/xsmartbartx/NEXORA/security",
  },
  {
    id: "monthly-backup-test",
    cadence: "monthly",
    title: "Backup restore test",
    detail: "Restore the latest backup into a scratch database and read it back.",
    href: "https://status.onenexora.com",
  },
  {
    id: "monthly-access",
    cadence: "monthly",
    title: "Access review",
    detail: "Who can reach GitHub, Clerk, Stripe, OCI, Google Workspace; revoke stale API keys.",
    href: "https://github.com/xsmartbartx/NEXORA/settings/access",
  },
  {
    id: "monthly-unused",
    cadence: "monthly",
    title: "Unused resources",
    detail: "Old volumes, images, DNS records, test accounts.",
    href: "https://cloud.oracle.com",
  },
  {
    id: "monthly-cloud-costs",
    cadence: "monthly",
    title: "Cloud costs",
    detail: "This month against last; explain any jump.",
    href: "https://cloud.oracle.com/account-management/cost-analysis",
  },
];

/** Rolling windows rather than calendar boundaries: "weekly" means done within the last 7 days. */
const PERIOD_DAYS: Record<Cadence, number> = { daily: 1, weekly: 7, monthly: 30 };

export type DueState = "ok" | "due" | "overdue";

/** `ok` inside the window, `due` once it has elapsed, `overdue` after a second full window (or never done). */
export function dueState(
  cadence: Cadence,
  lastDone: Date | null,
  now: number = Date.now(),
): DueState {
  if (!lastDone) return "overdue";
  const ageDays = (now - lastDone.getTime()) / 86_400_000;
  const period = PERIOD_DAYS[cadence];
  if (ageDays < period) return "ok";
  return ageDays < period * 2 ? "due" : "overdue";
}

export interface ChecklistItem extends ChecklistTask {
  lastDone: Date | null;
  state: DueState;
}

export async function collectChecklist(): Promise<ChecklistItem[]> {
  const rows = await db
    .select({
      taskId: opsChecklistCompletions.taskId,
      lastDone: max(opsChecklistCompletions.completedAt),
    })
    .from(opsChecklistCompletions)
    .groupBy(opsChecklistCompletions.taskId);
  const last = new Map(rows.map((row) => [row.taskId, row.lastDone]));

  return CHECKLIST.map((task) => {
    const lastDone = last.get(task.id) ?? null;
    return { ...task, lastDone, state: dueState(task.cadence, lastDone) };
  });
}

export async function markTaskDone(taskId: string, actorId: string): Promise<void> {
  if (!CHECKLIST.some((task) => task.id === taskId)) throw new Error("Unknown checklist task.");
  await db.insert(opsChecklistCompletions).values({ taskId, completedBy: actorId });
  await db.insert(auditEvents).values({
    orgId: null,
    actorId,
    action: "admin.checklist.completed",
    resourceType: "checklist_task",
    resourceId: taskId,
  });
}
