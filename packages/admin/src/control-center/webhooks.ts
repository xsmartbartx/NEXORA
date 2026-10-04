import { and, desc, eq, gte, like, sql } from "drizzle-orm";
import { getStripeClient, isStripeConfigured } from "@nexora/billing";
import { auditEvents, db } from "@nexora/database";
import { NotConnected } from "./result";

const MINUTE = 60_000;
/** Stripe delivers within seconds; an event still waiting after this is being retried or has failed. */
export const STUCK_AFTER_MINUTES = 10;
export const SYNC_ACTION = "billing.vigilo_sync.completed";

/** The fields read from a Stripe webhook endpoint, kept structural so the logic is testable without the SDK. */
export interface EndpointLike {
  id: string;
  url: string;
  status: string;
  enabled_events: string[];
}

export interface EndpointInfo {
  url: string;
  enabled: boolean;
  /** `*` means every event. */
  events: number | "all";
}

export interface EndpointsSummary {
  endpoints: EndpointInfo[];
  /** Stripe switches an endpoint off after repeated failures, and it then stops receiving events silently. */
  disabled: number;
}

export function summarizeEndpoints(endpoints: EndpointLike[]): EndpointsSummary {
  const infos = endpoints.map((endpoint) => ({
    url: endpoint.url,
    enabled: endpoint.status === "enabled",
    events: endpoint.enabled_events.includes("*")
      ? ("all" as const)
      : endpoint.enabled_events.length,
  }));
  return { endpoints: infos, disabled: infos.filter((e) => !e.enabled).length };
}

export interface EventLike {
  id: string;
  type: string;
  /** Unix seconds. */
  created: number;
  /** Endpoints that have not yet confirmed delivery. */
  pending_webhooks: number;
}

export interface StuckEvent {
  id: string;
  type: string;
  ageMinutes: number;
  pendingWebhooks: number;
}

export interface DeliverySummary {
  events24h: number;
  topTypes: { type: string; count: number }[];
  stuck: StuckEvent[];
  /** True when Stripe returned a full page, so the real count is at least this. */
  capped: boolean;
}

const EVENTS_PAGE = 100;

/** Newest-first events: how many in 24 hours, the busiest types, and any still undelivered after STUCK_AFTER_MINUTES. */
export function summarizeDelivery(events: EventLike[], now: number = Date.now()): DeliverySummary {
  const recent = events.filter((event) => now - event.created * 1000 <= 24 * 60 * MINUTE);

  const counts = new Map<string, number>();
  for (const event of recent) counts.set(event.type, (counts.get(event.type) ?? 0) + 1);

  const stuck = recent
    .filter(
      (event) =>
        event.pending_webhooks > 0 && now - event.created * 1000 > STUCK_AFTER_MINUTES * MINUTE,
    )
    .map((event) => ({
      id: event.id,
      type: event.type,
      ageMinutes: Math.round((now - event.created * 1000) / MINUTE),
      pendingWebhooks: event.pending_webhooks,
    }))
    .slice(0, 10);

  return {
    events24h: recent.length,
    topTypes: [...counts.entries()]
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    stuck,
    capped: events.length >= EVENTS_PAGE && recent.length === events.length,
  };
}

export async function collectStripeEndpoints(): Promise<EndpointsSummary> {
  if (!isStripeConfigured()) throw new NotConnected("Stripe", "Set STRIPE_SECRET_KEY.");
  const list = await getStripeClient().webhookEndpoints.list({ limit: 100 });
  return summarizeEndpoints(list.data as unknown as EndpointLike[]);
}

export async function collectStripeDelivery(): Promise<DeliverySummary> {
  if (!isStripeConfigured()) throw new NotConnected("Stripe", "Set STRIPE_SECRET_KEY.");
  const list = await getStripeClient().events.list({ limit: EVENTS_PAGE });
  return summarizeDelivery(list.data as unknown as EventLike[]);
}

export interface SyncSummary {
  success7d: number;
  failure7d: number;
  lastFailure: { at: Date; orgId: string | null; error: string | null } | null;
  lastSuccess: Date | null;
}

/** Core -> Vigilo plan syncs, from the audit events the Stripe webhook leaves for each attempt. */
export async function collectVigiloSync(now: Date = new Date()): Promise<SyncSummary> {
  const since = new Date(now.getTime() - 7 * 24 * 60 * MINUTE);
  const where = and(like(auditEvents.action, SYNC_ACTION), gte(auditEvents.createdAt, since));

  const [counts, [failure], [success]] = await Promise.all([
    db
      .select({
        outcome: auditEvents.outcome,
        total: sql<number>`count(*)`.mapWith(Number),
      })
      .from(auditEvents)
      .where(where)
      .groupBy(auditEvents.outcome),
    db
      .select()
      .from(auditEvents)
      .where(and(where, eq(auditEvents.outcome, "failure")))
      .orderBy(desc(auditEvents.createdAt))
      .limit(1),
    db
      .select({ createdAt: auditEvents.createdAt })
      .from(auditEvents)
      .where(and(where, eq(auditEvents.outcome, "success")))
      .orderBy(desc(auditEvents.createdAt))
      .limit(1),
  ]);

  const total = (outcome: string) => counts.find((c) => c.outcome === outcome)?.total ?? 0;
  const error = (failure?.metadata as { error?: unknown } | null | undefined)?.error;
  return {
    success7d: total("success"),
    failure7d: total("failure"),
    lastFailure: failure
      ? {
          at: failure.createdAt,
          orgId: failure.orgId,
          error: typeof error === "string" ? error : null,
        }
      : null,
    lastSuccess: success?.createdAt ?? null,
  };
}
