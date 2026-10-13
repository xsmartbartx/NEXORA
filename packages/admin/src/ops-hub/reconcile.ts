import { fingerprint } from "./fingerprint";
import type {
  Action,
  AlertRow,
  HubItem,
  Notification,
  NotificationKind,
  ReconcileConfig,
} from "./types";

export interface ReconcileInput {
  now: Date;
  config: ReconcileConfig;
  /** False in quiet hours: warnings are held back, criticals are always sent. */
  warningsAllowed: boolean;
  /** The currently open incidents. */
  open: AlertRow[];
  /** Everything the pollers report right now. `null` means no poll happened, so absence proves nothing. */
  polled: HubItem[] | null;
  /** Items a sender (Grafana) reports as firing. */
  pushed?: HubItem[];
  /** Fingerprints a sender reports as resolved. */
  resolved?: string[];
  /** Also close pushed incidents that nobody refreshed for `pushTtlMs`. */
  expirePush?: boolean;
}

type Context = Pick<ReconcileInput, "now" | "config" | "warningsAllowed">;

/** Several items with the same fingerprint are one problem; keep the worst severity. */
function dedupe(items: HubItem[]): Map<string, HubItem> {
  const byFingerprint = new Map<string, HubItem>();
  for (const item of items) {
    const key = fingerprint(item.source, item.text);
    const seen = byFingerprint.get(key);
    if (!seen || (seen.severity === "warning" && item.severity === "critical")) {
      byFingerprint.set(key, item);
    }
  }
  return byFingerprint;
}

const canSend = (severity: HubItem["severity"], ctx: Context): boolean =>
  severity === "critical" || ctx.warningsAllowed;

function note(
  kind: NotificationKind,
  key: string,
  item: Pick<HubItem, "source" | "severity" | "text" | "detail">,
  since: Date,
): Notification {
  return {
    kind,
    fingerprint: key,
    source: item.source,
    severity: item.severity,
    title: item.text,
    detail: item.detail,
    since,
  };
}

function rowItem(row: AlertRow): HubItem {
  return {
    source: row.source,
    origin: row.origin,
    severity: row.severity,
    text: row.title,
    detail: row.detail ?? undefined,
  };
}

/** A problem that was reported again: maybe escalated, maybe held earlier, maybe due a reminder. */
function present(row: AlertRow, item: HubItem, ctx: Context): Action {
  const escalated = item.severity === "critical" && row.severity === "warning";
  let notify: Notification | null = null;
  if (escalated) {
    notify = note("escalated", row.fingerprint, item, row.firstSeenAt);
  } else if (row.lastNotifiedAt === null) {
    if (canSend(item.severity, ctx))
      notify = note("opened", row.fingerprint, item, row.firstSeenAt);
  } else if (
    item.severity === "critical" &&
    ctx.now.getTime() - row.lastNotifiedAt.getTime() >= ctx.config.reminderMs
  ) {
    notify = note("reminder", row.fingerprint, item, row.firstSeenAt);
  }
  return { type: "touch", id: row.id, item, resetNotified: escalated, notify };
}

/** Say "resolved" only to people who were told about the problem in the first place. */
function resolution(row: AlertRow, ctx: Context): Action {
  const tellThem = row.lastNotifiedAt !== null && canSend(row.severity, ctx);
  return {
    type: "resolve",
    id: row.id,
    notify: tellThem ? note("resolved", row.fingerprint, rowItem(row), row.firstSeenAt) : null,
  };
}

/** A problem that was not reported this time. */
function absent(row: AlertRow, input: ReconcileInput, ctx: Context): Action | null {
  if (row.origin === "poll") {
    if (input.polled === null) return null;
    const missed = row.missedTicks + 1;
    return missed < ctx.config.resolveAfterMissed
      ? { type: "miss", id: row.id }
      : resolution(row, ctx);
  }
  const stale = ctx.now.getTime() - row.lastSeenAt.getTime() > ctx.config.pushTtlMs;
  return input.expirePush && stale ? { type: "resolve", id: row.id, notify: null } : null;
}

/**
 * Compares what is wrong now with what is already open and returns what to store and what to
 * announce. Pure: the same input always gives the same answer, which is what makes it testable.
 */
export function reconcile(input: ReconcileInput): Action[] {
  const ctx: Context = {
    now: input.now,
    config: input.config,
    warningsAllowed: input.warningsAllowed,
  };
  const current = dedupe([...(input.polled ?? []), ...(input.pushed ?? [])]);
  const resolvedByCaller = new Set(input.resolved ?? []);
  const openByFingerprint = new Map(input.open.map((row) => [row.fingerprint, row]));
  const actions: Action[] = [];

  for (const [key, item] of current) {
    const row = openByFingerprint.get(key);
    if (row) {
      actions.push(present(row, item, ctx));
    } else {
      const notify = canSend(item.severity, ctx) ? note("opened", key, item, ctx.now) : null;
      actions.push({ type: "open", fingerprint: key, item, notify });
    }
  }

  for (const row of input.open) {
    if (current.has(row.fingerprint)) continue;
    if (row.origin === "push" && resolvedByCaller.has(row.fingerprint)) {
      actions.push(resolution(row, ctx));
      continue;
    }
    const action = absent(row, input, ctx);
    if (action) actions.push(action);
  }
  return actions;
}
