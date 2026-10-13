import { and, eq, inArray, sql } from "drizzle-orm";
import { auditEvents, db, opsAlerts, type OpsAlert } from "@nexora/database";
import type { Action, AlertRow, Origin, Severity } from "./types";

export interface JournalEntry {
  /** `opened`, `resolved`, `reminder`, `escalated`, or `failed` for a message that could not be sent. */
  event: string;
  fingerprint: string;
  source: string;
  severity: Severity;
  outcome: "success" | "failure";
  /** A short, secret-free reason for a failure. */
  error?: string;
}

/** The hub's whole view of storage. The real one is below; tests use an in-memory twin. */
export interface Store {
  loadOpen(): Promise<AlertRow[]>;
  apply(actions: Action[], now: Date): Promise<void>;
  markNotified(fingerprints: string[], now: Date): Promise<void>;
  journal(entries: JournalEntry[]): Promise<void>;
}

const severityOf = (value: string): Severity => (value === "critical" ? "critical" : "warning");
const originOf = (value: string): Origin => (value === "push" ? "push" : "poll");

function toRow(row: OpsAlert): AlertRow {
  return {
    id: row.id,
    fingerprint: row.fingerprint,
    source: row.source,
    origin: originOf(row.origin),
    severity: severityOf(row.severity),
    title: row.title,
    detail: row.detail,
    state: row.state === "resolved" ? "resolved" : "open",
    firstSeenAt: row.firstSeenAt,
    lastSeenAt: row.lastSeenAt,
    lastNotifiedAt: row.lastNotifiedAt,
    missedTicks: row.missedTicks,
    notifyCount: row.notifyCount,
  };
}

export function createDbStore(): Store {
  return {
    async loadOpen() {
      const rows = await db.select().from(opsAlerts).where(eq(opsAlerts.state, "open"));
      return rows.map(toRow);
    },

    async apply(actions, now) {
      if (actions.length === 0) return;
      await db.transaction(async (tx) => {
        for (const action of actions) {
          switch (action.type) {
            case "open":
              // A concurrent writer may have opened the same incident a moment ago; that is fine.
              await tx
                .insert(opsAlerts)
                .values({
                  fingerprint: action.fingerprint,
                  source: action.item.source,
                  origin: action.item.origin,
                  severity: action.item.severity,
                  title: action.item.text,
                  detail: action.item.detail ?? null,
                  firstSeenAt: now,
                  lastSeenAt: now,
                })
                .onConflictDoNothing();
              break;
            case "touch":
              await tx
                .update(opsAlerts)
                .set({
                  severity: action.item.severity,
                  detail: action.item.detail ?? null,
                  lastSeenAt: now,
                  missedTicks: 0,
                  ...(action.resetNotified ? { lastNotifiedAt: null } : {}),
                })
                .where(and(eq(opsAlerts.id, action.id), eq(opsAlerts.state, "open")));
              break;
            case "miss":
              await tx
                .update(opsAlerts)
                .set({ missedTicks: sql`${opsAlerts.missedTicks} + 1` })
                .where(and(eq(opsAlerts.id, action.id), eq(opsAlerts.state, "open")));
              break;
            case "resolve":
              await tx
                .update(opsAlerts)
                .set({ state: "resolved", resolvedAt: now })
                .where(and(eq(opsAlerts.id, action.id), eq(opsAlerts.state, "open")));
              break;
          }
        }
      });
    },

    async markNotified(fingerprints, now) {
      if (fingerprints.length === 0) return;
      await db
        .update(opsAlerts)
        .set({ lastNotifiedAt: now, notifyCount: sql`${opsAlerts.notifyCount} + 1` })
        .where(and(eq(opsAlerts.state, "open"), inArray(opsAlerts.fingerprint, fingerprints)));
    },

    async journal(entries) {
      if (entries.length === 0) return;
      await db.insert(auditEvents).values(
        entries.map((entry) => ({
          orgId: null,
          actorId: "ops-hub",
          action: `ops.alert.${entry.event}`,
          resourceType: "ops_alert",
          resourceId: entry.fingerprint,
          outcome: entry.outcome,
          metadata: {
            source: entry.source,
            severity: entry.severity,
            ...(entry.error ? { error: entry.error } : {}),
          },
        })),
      );
    },
  };
}
