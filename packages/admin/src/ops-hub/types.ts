export type Severity = "warning" | "critical";

/** `poll` items come from the Control Center on every tick; `push` items are sent to the hub by something else (Grafana). */
export type Origin = "poll" | "push";

export interface HubItem {
  source: string;
  origin: Origin;
  severity: Severity;
  /** What is wrong, in one plain sentence. Also the basis of the fingerprint, so keep it stable. */
  text: string;
  detail?: string;
}

/** The stored view of one incident (a row of `ops_alerts`). */
export interface AlertRow {
  id: string;
  fingerprint: string;
  source: string;
  origin: Origin;
  severity: Severity;
  title: string;
  detail: string | null;
  state: "open" | "resolved";
  firstSeenAt: Date;
  lastSeenAt: Date;
  lastNotifiedAt: Date | null;
  missedTicks: number;
  notifyCount: number;
}

export type NotificationKind = "opened" | "escalated" | "reminder" | "resolved";

export interface Notification {
  kind: NotificationKind;
  fingerprint: string;
  source: string;
  severity: Severity;
  title: string;
  detail?: string;
  /** When the incident started. */
  since: Date;
}

/** What the store has to do, decided by the reconciler and carried out afterwards. */
export type Action =
  | { type: "open"; fingerprint: string; item: HubItem; notify: Notification | null }
  | {
      type: "touch";
      id: string;
      item: HubItem;
      /** Forget the last notification so the next tick sends it again (an escalation that could not be sent). */
      resetNotified: boolean;
      notify: Notification | null;
    }
  | { type: "miss"; id: string }
  | { type: "resolve"; id: string; notify: Notification | null };

export interface ReconcileConfig {
  /** How often a still-open critical alert is repeated. */
  reminderMs: number;
  /** A polled alert is resolved after this many consecutive polls without it. */
  resolveAfterMissed: number;
  /** A pushed alert nobody refreshed for this long is closed without a message. */
  pushTtlMs: number;
}

export const DEFAULT_RECONCILE: ReconcileConfig = {
  reminderMs: 6 * 60 * 60_000,
  resolveAfterMissed: 2,
  pushTtlMs: 12 * 60 * 60_000,
};
