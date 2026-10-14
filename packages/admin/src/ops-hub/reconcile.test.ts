import { describe, expect, it } from "vitest";
import { fingerprint, isNoise } from "./fingerprint";
import { reconcile, type ReconcileInput } from "./reconcile";
import {
  DEFAULT_RECONCILE,
  type Action,
  type AlertRow,
  type HubItem,
  type Severity,
} from "./types";

const NOW = new Date("2026-10-13T10:00:00Z");
const MIN = 60_000;
const HOUR = 60 * MIN;

const item = (
  text: string,
  severity: Severity = "critical",
  origin: HubItem["origin"] = "poll",
  source = origin === "poll" ? "control-center" : "grafana",
): HubItem => ({ source, origin, severity, text });

function row(text: string, over: Partial<AlertRow> = {}): AlertRow {
  const source = over.source ?? (over.origin === "push" ? "grafana" : "control-center");
  return {
    id: `id-${text}`,
    fingerprint: fingerprint(source, text),
    source,
    origin: "poll",
    severity: "critical",
    title: text,
    detail: null,
    state: "open",
    firstSeenAt: new Date(NOW.getTime() - 2 * HOUR),
    lastSeenAt: new Date(NOW.getTime() - 5 * MIN),
    lastNotifiedAt: new Date(NOW.getTime() - 2 * HOUR),
    missedTicks: 0,
    notifyCount: 1,
    resolutionPending: false,
    ...over,
  };
}

const run = (over: Partial<ReconcileInput>): Action[] =>
  reconcile({
    now: NOW,
    config: DEFAULT_RECONCILE,
    warningsAllowed: true,
    open: [],
    polled: [],
    ...over,
  });

const kinds = (actions: Action[]) =>
  actions.map((a) => `${a.type}${"notify" in a && a.notify ? `:${a.notify.kind}` : ""}`);

describe("a problem appears", () => {
  it("opens an incident and announces a critical one immediately", () => {
    expect(kinds(run({ polled: [item("Website is down.")] }))).toEqual(["open:opened"]);
  });

  it("announces a warning outside quiet hours", () => {
    expect(kinds(run({ polled: [item("Docs is responding slowly.", "warning")] }))).toEqual([
      "open:opened",
    ]);
  });

  it("holds a warning during quiet hours but never a critical", () => {
    const warning = run({ warningsAllowed: false, polled: [item("Docs is slow.", "warning")] });
    expect(kinds(warning)).toEqual(["open"]);
    const critical = run({ warningsAllowed: false, polled: [item("Website is down.")] });
    expect(kinds(critical)).toEqual(["open:opened"]);
  });

  it("announces a held warning once quiet hours end", () => {
    const held = row("Docs is slow.", { severity: "warning", lastNotifiedAt: null });
    expect(kinds(run({ open: [held], polled: [item("Docs is slow.", "warning")] }))).toEqual([
      "touch:opened",
    ]);
    expect(
      kinds(
        run({ warningsAllowed: false, open: [held], polled: [item("Docs is slow.", "warning")] }),
      ),
    ).toEqual(["touch"]);
  });
});

describe("a problem keeps being reported", () => {
  it("says nothing the second time (no repeated alerts)", () => {
    const open = row("Website is down.", { lastNotifiedAt: new Date(NOW.getTime() - 10 * MIN) });
    expect(kinds(run({ open: [open], polled: [item("Website is down.")] }))).toEqual(["touch"]);
  });

  it("treats a changing number as the same incident", () => {
    const open = row("13 owner review(s) are overdue.", { severity: "warning" });
    const actions = run({
      open: [open],
      polled: [item("12 owner review(s) are overdue.", "warning")],
    });
    expect(kinds(actions)).toEqual(["touch"]);
    expect(actions).toHaveLength(1);
  });

  it("keeps different services as different incidents", () => {
    expect(fingerprint("control-center", "API is down.")).not.toBe(
      fingerprint("control-center", "Docs is down."),
    );
  });

  it("reminds about a critical one after the reminder interval, not before", () => {
    const quiet = row("Website is down.", { lastNotifiedAt: new Date(NOW.getTime() - 5 * HOUR) });
    expect(kinds(run({ open: [quiet], polled: [item("Website is down.")] }))).toEqual(["touch"]);
    const due = row("Website is down.", { lastNotifiedAt: new Date(NOW.getTime() - 7 * HOUR) });
    expect(kinds(run({ open: [due], polled: [item("Website is down.")] }))).toEqual([
      "touch:reminder",
    ]);
  });

  it("never reminds about a warning", () => {
    const old = row("Docs is slow.", {
      severity: "warning",
      lastNotifiedAt: new Date(NOW.getTime() - 30 * HOUR),
    });
    expect(kinds(run({ open: [old], polled: [item("Docs is slow.", "warning")] }))).toEqual([
      "touch",
    ]);
  });

  it("escalates a warning that became critical, even in quiet hours, and forgets the old notice", () => {
    const open = row("Cert expires.", { severity: "warning" });
    const [action] = run({
      warningsAllowed: false,
      open: [open],
      polled: [item("Cert expires.", "critical")],
    });
    expect(action).toMatchObject({ type: "touch", resetNotified: true });
    expect(kinds([action!])).toEqual(["touch:escalated"]);
  });

  it("quietly downgrades a critical that became a warning", () => {
    const open = row("Cert expires.", { severity: "critical" });
    expect(kinds(run({ open: [open], polled: [item("Cert expires.", "warning")] }))).toEqual([
      "touch",
    ]);
  });

  it("merges duplicates in one batch and keeps the worse severity", () => {
    const actions = run({
      polled: [item("Website is down.", "warning"), item("Website is down.", "critical")],
    });
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({ type: "open", item: { severity: "critical" } });
  });
});

describe("a problem goes away", () => {
  const open = row("Website is down.");

  it("waits for a second clean poll before resolving", () => {
    expect(run({ open: [open], polled: [] })).toEqual([{ type: "miss", id: open.id }]);
    const second = row("Website is down.", { missedTicks: 1 });
    expect(kinds(run({ open: [second], polled: [] }))).toEqual(["resolve:resolved"]);
  });

  it("resolves quietly when nobody was ever told", () => {
    const unannounced = row("Docs is slow.", {
      severity: "warning",
      lastNotifiedAt: null,
      missedTicks: 1,
    });
    expect(kinds(run({ open: [unannounced], polled: [] }))).toEqual(["resolve"]);
  });

  it("does not announce a warning's resolution during quiet hours", () => {
    const warned = row("Docs is slow.", { severity: "warning", missedTicks: 1 });
    expect(kinds(run({ warningsAllowed: false, open: [warned], polled: [] }))).toEqual(["resolve"]);
  });

  it("concludes nothing when the poll itself failed (polled is null)", () => {
    const stale = row("Website is down.", { missedTicks: 5 });
    expect(run({ open: [stale], polled: null })).toEqual([]);
  });

  it("an empty poll resolves everything, a failed poll resolves nothing", () => {
    const rows = [row("a is down."), row("b is down.")].map((r) => ({ ...r, missedTicks: 1 }));
    expect(kinds(run({ open: rows, polled: [] }))).toEqual([
      "resolve:resolved",
      "resolve:resolved",
    ]);
    expect(run({ open: rows, polled: null })).toEqual([]);
  });

  it("respects a longer resolve window", () => {
    const config = { ...DEFAULT_RECONCILE, resolveAfterMissed: 3 };
    const second = row("Website is down.", { missedTicks: 1 });
    expect(run({ config, open: [second], polled: [] })).toEqual([{ type: "miss", id: second.id }]);
  });
});

describe("pushed alerts (Grafana)", () => {
  it("opens a pushed incident and keeps it apart from polled ones", () => {
    const actions = run({ polled: null, pushed: [item("Postgres is down", "critical", "push")] });
    expect(kinds(actions)).toEqual(["open:opened"]);
    expect(actions[0]).toMatchObject({ item: { origin: "push", source: "grafana" } });
  });

  it("is not resolved by a poll that does not list it", () => {
    const pushed = row("Postgres is down", { origin: "push", source: "grafana", missedTicks: 9 });
    expect(run({ open: [pushed], polled: [] })).toEqual([]);
  });

  it("is resolved when the sender says so, and the resolution is announced", () => {
    const pushed = row("Postgres is down", { origin: "push", source: "grafana" });
    const actions = run({
      polled: null,
      open: [pushed],
      resolved: [fingerprint("grafana", "Postgres is down")],
    });
    expect(kinds(actions)).toEqual(["resolve:resolved"]);
  });

  it("closes a pushed incident nobody refreshed for the TTL, without a message", () => {
    const stale = row("Postgres is down", {
      origin: "push",
      source: "grafana",
      lastSeenAt: new Date(NOW.getTime() - 13 * HOUR),
    });
    expect(kinds(run({ open: [stale], polled: [], expirePush: true }))).toEqual(["resolve"]);
    expect(run({ open: [stale], polled: [] })).toEqual([]);
  });

  it("keeps a fresh pushed incident open on a tick", () => {
    const fresh = row("Postgres is down", { origin: "push", source: "grafana" });
    expect(run({ open: [fresh], polled: [], expirePush: true })).toEqual([]);
  });
});

describe("pushed incidents on a tick", () => {
  const pushedRow = (over: Partial<AlertRow> = {}) =>
    row("Postgres is down", { origin: "push", source: "grafana", ...over });

  it("owes the first message if it never went out, without refreshing the row", () => {
    const unannounced = pushedRow({ lastNotifiedAt: null });
    const actions = run({ open: [unannounced], polled: [] });
    expect(kinds(actions)).toEqual(["notify:opened"]);
    expect(actions[0]).toMatchObject({ type: "notify", id: unannounced.id });
  });

  it("holds a pushed warning during quiet hours and sends it afterwards", () => {
    const held = pushedRow({ severity: "warning", lastNotifiedAt: null });
    expect(run({ warningsAllowed: false, open: [held], polled: [] })).toEqual([]);
    expect(kinds(run({ open: [held], polled: [] }))).toEqual(["notify:opened"]);
  });

  it("reminds about a pushed critical when due, never about a warning", () => {
    const due = pushedRow({ lastNotifiedAt: new Date(NOW.getTime() - 7 * HOUR) });
    expect(kinds(run({ open: [due], polled: [] }))).toEqual(["notify:reminder"]);
    const warn = pushedRow({
      severity: "warning",
      lastNotifiedAt: new Date(NOW.getTime() - 30 * HOUR),
    });
    expect(run({ open: [warn], polled: [] })).toEqual([]);
  });

  it("says nothing between reminders", () => {
    expect(run({ open: [pushedRow()], polled: [] })).toEqual([]);
  });

  it("is left alone by a batch of pushed events (no tick, nothing concluded)", () => {
    const unannounced = pushedRow({ lastNotifiedAt: null });
    expect(run({ open: [unannounced], polled: null, pushed: [] })).toEqual([]);
  });

  it("retries a resolution whose message did not go out", () => {
    const pending = pushedRow({ resolutionPending: true });
    expect(kinds(run({ open: [pending], polled: [] }))).toEqual(["resolve:resolved"]);
    // A reminder is not due and the incident is fresh, yet the pending resolution wins.
    expect(
      kinds(
        run({ open: [pushedRow({ resolutionPending: true, lastNotifiedAt: null })], polled: [] }),
      ),
    ).toEqual(["resolve"]);
  });

  it("treats a pushed incident that fires again as alive, not as resolved", () => {
    const pending = pushedRow({ resolutionPending: true });
    const actions = run({
      open: [pending],
      polled: null,
      pushed: [item("Postgres is down", "critical", "push")],
    });
    expect(kinds(actions)).toEqual(["touch"]);
  });

  it("closes a stale pushed incident silently, even when a reminder would be due", () => {
    const stale = pushedRow({
      lastSeenAt: new Date(NOW.getTime() - 13 * HOUR),
      lastNotifiedAt: new Date(NOW.getTime() - 8 * HOUR),
    });
    expect(kinds(run({ open: [stale], polled: [], expirePush: true }))).toEqual(["resolve"]);
    expect(run({ open: [stale], polled: [] })).toEqual([]);
  });
});

describe("noise", () => {
  it("keeps the overdue-reviews panel item off the phone", () => {
    expect(isNoise({ text: "13 owner review(s) are overdue." })).toBe(true);
    expect(isNoise({ text: "Website is down." })).toBe(false);
    expect(isNoise({ text: "3 subscription(s) are past due." })).toBe(false);
  });
});
