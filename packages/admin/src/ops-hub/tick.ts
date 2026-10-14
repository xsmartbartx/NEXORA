import type { Delivery } from "./channels";
import type { HubConfig } from "./config";
import { isQuiet } from "./quiet-hours";
import { reconcile } from "./reconcile";
import { render, type Rendered } from "./render";
import type { JournalEntry, Store } from "./store";
import type { Action, AlertRow, HubItem, Notification } from "./types";

export interface HubDeps {
  store: Store;
  config: HubConfig;
  now: () => Date;
  /** Sends one rendered message. Absent when no channel is configured. */
  send: ((message: Rendered) => Promise<Delivery>) | null;
}

export interface Summary {
  /** False when the run was refused or could not collect, and therefore changed nothing. */
  ran: boolean;
  open: number;
  opened: number;
  /** Incidents actually closed this run. */
  resolved: number;
  sent: number;
  failed: number;
  /**
   * Messages over the per-tick cap. They are not lost: an unsent "opened" or reminder is owed
   * again on the next tick, and an incident whose "resolved" message did not go out stays open
   * until it has (a polled one is resolved again by the next tick, a pushed one is flagged).
   */
  deferred: number;
  /** True when there is somewhere to send messages. */
  channel: boolean;
}

export interface Batch {
  /** `null`: no poll happened, so nothing is concluded from absence. */
  polled: HubItem[] | null;
  pushed?: HubItem[];
  resolved?: string[];
  expirePush?: boolean;
}

const emptySummary = (channel: boolean): Summary => ({
  ran: false,
  open: 0,
  opened: 0,
  resolved: 0,
  sent: 0,
  failed: 0,
  deferred: 0,
  channel,
});

/** New criticals first, then resolutions (so they are never the ones dropped), then warnings, then reminders. */
function priority(n: Notification): number {
  if (n.kind === "resolved") return 1;
  if (n.kind === "reminder") return 3;
  return n.severity === "critical" ? 0 : 2;
}

function notificationsOf(actions: Action[]): Notification[] {
  const found: Notification[] = [];
  for (const action of actions) {
    if ("notify" in action && action.notify) found.push(action.notify);
  }
  return found.sort((a, b) => priority(a) - priority(b));
}

function transitions(actions: Action[]): JournalEntry[] {
  const entries: JournalEntry[] = [];
  for (const action of actions) {
    if (action.type === "open") {
      entries.push({
        event: "opened",
        fingerprint: action.fingerprint,
        source: action.item.source,
        severity: action.item.severity,
        outcome: "success",
      });
    }
  }
  return entries;
}

interface Announced {
  sent: number;
  failed: number;
  deferred: number;
  /** Fingerprints whose "resolved" message was delivered. */
  resolvedDelivered: Set<string>;
}

/** Sends what fits, remembers what arrived, and journals both outcomes. */
async function announce(
  deps: HubDeps,
  notifications: Notification[],
  now: Date,
): Promise<Announced> {
  const result: Announced = { sent: 0, failed: 0, deferred: 0, resolvedDelivered: new Set() };
  if (!deps.send || notifications.length === 0) return result;
  const batch = notifications.slice(0, deps.config.maxPerTick);
  result.deferred = notifications.length - batch.length;

  const delivered: string[] = [];
  const journal: JournalEntry[] = [];
  for (const n of batch) {
    const outcome = await deps.send(render(n, now, deps.config.consoleUrl));
    const entry = { fingerprint: n.fingerprint, source: n.source, severity: n.severity };
    if (outcome.ok) {
      result.sent += 1;
      if (n.kind === "resolved") result.resolvedDelivered.add(n.fingerprint);
      else delivered.push(n.fingerprint);
      journal.push({ ...entry, event: n.kind, outcome: "success" });
    } else {
      result.failed += 1;
      journal.push({ ...entry, event: "failed", outcome: "failure", error: outcome.error });
    }
  }
  await deps.store.markNotified(delivered, now);
  await deps.store.journal(journal);
  return result;
}

/**
 * A resolution that has a message to send is closed only once the message is out. If it is not
 * (the channel failed, or it did not fit under the cap) the incident stays open: a polled one is
 * resolved again by the next tick; a pushed one cannot be re-derived from a poll, so it is
 * flagged and the next tick retries. Returns how many incidents were closed.
 */
async function closeResolutions(
  deps: HubDeps,
  held: Extract<Action, { type: "resolve" }>[],
  announced: Announced,
  open: AlertRow[],
  now: Date,
): Promise<number> {
  const done: string[] = [];
  const stuckPushed: string[] = [];
  const originOf = new Map(open.map((row) => [row.id, row.origin]));
  for (const action of held) {
    if (action.notify && announced.resolvedDelivered.has(action.notify.fingerprint)) {
      done.push(action.id);
    } else if (originOf.get(action.id) === "push") {
      stuckPushed.push(action.id);
    }
  }
  await deps.store.resolve(done, now);
  await deps.store.markResolutionPending(stuckPushed);
  return done.length;
}

let running = false;

/**
 * The one path every alert takes: reconcile with what is open, store the result, then announce.
 * Storing comes first on purpose: if sending fails, the incident is already recorded and is
 * simply announced again on the next tick (an unsent alert is never marked as sent).
 * One tick at a time per process; the console is a single container.
 */
export async function processBatch(deps: HubDeps, batch: Batch): Promise<Summary> {
  const channel = deps.send !== null;
  if (running) return emptySummary(channel);
  running = true;
  try {
    const now = deps.now();
    const open = await deps.store.loadOpen();
    const actions = reconcile({
      now,
      config: deps.config.reconcile,
      warningsAllowed: !isQuiet(now, deps.config.quietHours, deps.config.timeZone),
      open,
      polled: batch.polled,
      pushed: batch.pushed,
      resolved: batch.resolved,
      expirePush: batch.expirePush,
    });

    // With nobody to tell, a resolution has no message to wait for.
    const holdsMessage = (a: Action): a is Extract<Action, { type: "resolve" }> =>
      channel && a.type === "resolve" && a.notify !== null;
    const held = actions.filter(holdsMessage);
    await deps.store.apply(
      actions.filter((a) => !holdsMessage(a)),
      now,
    );
    await deps.store.journal(transitions(actions));

    const announced = await announce(deps, notificationsOf(actions), now);
    const closedWithMessage = await closeResolutions(deps, held, announced, open, now);

    const opened = actions.filter((a) => a.type === "open").length;
    const silent = actions.filter((a) => a.type === "resolve" && !holdsMessage(a)).length;
    const resolved = silent + closedWithMessage;
    return {
      ran: true,
      open: open.length + opened - resolved,
      opened,
      resolved,
      channel,
      sent: announced.sent,
      failed: announced.failed,
      deferred: announced.deferred,
    };
  } finally {
    running = false;
  }
}

/** For tests: forget a run that never finished. */
export function resetRunningForTests(): void {
  running = false;
}

/**
 * One scheduled run: ask the Control Center what is wrong now and reconcile. If collecting
 * fails nothing is concluded (a broken probe must not "resolve" every alert at once).
 */
export async function runTick(
  deps: HubDeps,
  collect: () => Promise<HubItem[]>,
  heartbeat?: () => Promise<void>,
): Promise<Summary> {
  let polled: HubItem[];
  try {
    polled = await collect();
  } catch {
    return emptySummary(deps.send !== null);
  }
  const summary = await processBatch(deps, { polled, expirePush: true });
  if (summary.ran && heartbeat) await heartbeat().catch(() => undefined);
  return summary;
}
