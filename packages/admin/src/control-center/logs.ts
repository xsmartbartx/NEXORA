import { and, count, desc, eq, gte, ilike, like, lt, or, sql } from "drizzle-orm";
import { auditEvents, db } from "@nexora/database";

export const LOG_WINDOWS_HOURS = [1, 24, 168, 720] as const;
export type LogWindowHours = (typeof LOG_WINDOWS_HOURS)[number];

export const LOG_PAGE_SIZE = 50;

export interface LogFilters {
  /** First segment of `<namespace>.<object>.<action>`, e.g. "sentinel". */
  namespace?: string;
  outcome?: "success" | "failure";
  orgId?: string;
  /** Substring of the action name. */
  q?: string;
  windowHours: LogWindowHours;
  /** Opaque keyset cursor for the next (older) page. */
  cursor?: string;
}

export interface LogRow {
  id: string;
  createdAt: Date;
  actorId: string;
  orgId: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  outcome: string;
  /** Truncated JSON, for a glance; the full record stays in the database. */
  detail: string | null;
}

export interface LogPage {
  rows: LogRow[];
  nextCursor: string | null;
}

export interface NamespaceStat {
  namespace: string;
  total: number;
  failures: number;
}

const NAMESPACE = /^[a-z0-9_-]{1,40}$/;
const ORG_ID = /^org_[A-Za-z0-9]{10,64}$/;
const CURSOR = /^(\d{4}-\d{2}-\d{2}T[\d:.]+Z)\|([0-9a-f-]{36})$/;

type Params = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return v === undefined || v === "" ? undefined : v;
}

/** Validates user-supplied query params against whitelists: anything unrecognised is dropped, never passed to the query. */
export function parseLogFilters(params: Params): LogFilters {
  const namespace = first(params.ns);
  const outcome = first(params.outcome);
  const orgId = first(params.org);
  const q = first(params.q)?.trim().slice(0, 80);
  const hours = Number(first(params.window));
  const cursor = first(params.cursor);

  return {
    namespace: namespace && NAMESPACE.test(namespace) ? namespace : undefined,
    outcome: outcome === "success" || outcome === "failure" ? outcome : undefined,
    orgId: orgId && ORG_ID.test(orgId) ? orgId : undefined,
    q: q || undefined,
    windowHours: (LOG_WINDOWS_HOURS as readonly number[]).includes(hours)
      ? (hours as LogWindowHours)
      : 24,
    cursor: cursor && CURSOR.test(cursor) ? cursor : undefined,
  };
}

export function encodeCursor(createdAt: Date, id: string): string {
  return `${createdAt.toISOString()}|${id}`;
}

export function decodeCursor(cursor: string): { createdAt: Date; id: string } | null {
  const match = CURSOR.exec(cursor);
  if (!match) return null;
  const createdAt = new Date(match[1]!);
  return Number.isNaN(createdAt.getTime()) ? null : { createdAt, id: match[2]! };
}

/** Escapes LIKE wildcards so a search for `100%` matches the text, not everything. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export function summarizeMetadata(metadata: unknown, max = 160): string | null {
  if (metadata === null || metadata === undefined) return null;
  const text = JSON.stringify(metadata);
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function whereFor(filters: LogFilters, now: Date) {
  const since = new Date(now.getTime() - filters.windowHours * 3_600_000);
  const conditions = [gte(auditEvents.createdAt, since)];
  if (filters.namespace) conditions.push(like(auditEvents.action, `${filters.namespace}.%`));
  if (filters.outcome) conditions.push(eq(auditEvents.outcome, filters.outcome));
  if (filters.orgId) conditions.push(eq(auditEvents.orgId, filters.orgId));
  if (filters.q) conditions.push(ilike(auditEvents.action, `%${escapeLike(filters.q)}%`));
  return conditions;
}

/**
 * The platform-wide audit log, newest first. Cross-organisation on purpose
 * (staff only — this package is the one place allowed to break the org
 * scoping rule), paginated by a (createdAt, id) keyset so deep pages stay
 * cheap and stable while new events arrive.
 */
export async function listPlatformLogs(
  filters: LogFilters,
  now: Date = new Date(),
): Promise<LogPage> {
  const conditions = whereFor(filters, now);
  const cursor = filters.cursor ? decodeCursor(filters.cursor) : null;
  if (cursor) {
    conditions.push(
      or(
        lt(auditEvents.createdAt, cursor.createdAt),
        and(eq(auditEvents.createdAt, cursor.createdAt), lt(auditEvents.id, cursor.id)),
      )!,
    );
  }

  const rows = await db
    .select()
    .from(auditEvents)
    .where(and(...conditions))
    .orderBy(desc(auditEvents.createdAt), desc(auditEvents.id))
    .limit(LOG_PAGE_SIZE + 1);

  const page = rows.slice(0, LOG_PAGE_SIZE);
  const last = page[page.length - 1];
  return {
    rows: page.map((row) => ({
      id: row.id,
      createdAt: row.createdAt,
      actorId: row.actorId,
      orgId: row.orgId,
      action: row.action,
      resourceType: row.resourceType,
      resourceId: row.resourceId,
      outcome: row.outcome,
      detail: summarizeMetadata(row.metadata),
    })),
    nextCursor: rows.length > LOG_PAGE_SIZE && last ? encodeCursor(last.createdAt, last.id) : null,
  };
}

/** Event counts per namespace inside the window (ignores the namespace and cursor filters, so the chips always show the whole picture). */
export async function logNamespaceStats(
  filters: LogFilters,
  now: Date = new Date(),
): Promise<NamespaceStat[]> {
  const conditions = whereFor({ ...filters, namespace: undefined, cursor: undefined }, now);
  const namespace = sql<string>`split_part(${auditEvents.action}, '.', 1)`;
  const rows = await db
    .select({
      namespace,
      total: count(),
      failures: sql<number>`count(*) filter (where ${auditEvents.outcome} = 'failure')`.mapWith(
        Number,
      ),
    })
    .from(auditEvents)
    .where(and(...conditions))
    .groupBy(namespace)
    .orderBy(desc(count()));
  return rows;
}
