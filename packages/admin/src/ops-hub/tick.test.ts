import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Delivery } from "./channels";
import { readConfig, type HubConfig } from "./config";
import type { Rendered } from "./render";
import type { JournalEntry, Store } from "./store";
import { processBatch, resetRunningForTests, runTick, type HubDeps } from "./tick";
import type { Action, AlertRow, HubItem } from "./types";

const SECRET_URL = "https://ntfy.sh/topic-that-must-never-leak-123";

/** An in-memory twin of the database store, with the same rules. */
function memoryStore() {
  const rows: AlertRow[] = [];
  const journal: JournalEntry[] = [];
  let next = 1;
  const store: Store = {
    async loadOpen() {
      return rows.filter((r) => r.state === "open").map((r) => ({ ...r }));
    },
    async apply(actions: Action[], now: Date) {
      for (const a of actions) {
        if (a.type === "open") {
          if (rows.some((r) => r.state === "open" && r.fingerprint === a.fingerprint)) continue;
          rows.push({
            id: `row-${next++}`,
            fingerprint: a.fingerprint,
            source: a.item.source,
            origin: a.item.origin,
            severity: a.item.severity,
            title: a.item.text,
            detail: a.item.detail ?? null,
            state: "open",
            firstSeenAt: now,
            lastSeenAt: now,
            lastNotifiedAt: null,
            missedTicks: 0,
            notifyCount: 0,
          });
          continue;
        }
        const row = rows.find((r) => r.id === a.id && r.state === "open");
        if (!row) continue;
        if (a.type === "touch") {
          row.severity = a.item.severity;
          row.lastSeenAt = now;
          row.missedTicks = 0;
          if (a.resetNotified) row.lastNotifiedAt = null;
        } else if (a.type === "miss") row.missedTicks += 1;
        else row.state = "resolved";
      }
    },
    async markNotified(fingerprints: string[], now: Date) {
      for (const r of rows) {
        if (r.state === "open" && fingerprints.includes(r.fingerprint)) {
          r.lastNotifiedAt = now;
          r.notifyCount += 1;
        }
      }
    },
    async journal(entries: JournalEntry[]) {
      journal.push(...entries);
    },
  };
  return { store, rows, journal };
}

const config = (over: Partial<HubConfig> = {}): HubConfig => ({
  ...readConfig({}),
  token: "x".repeat(32),
  channel: { url: SECRET_URL },
  consoleUrl: "https://console.example.com",
  ...over,
});

const item = (text: string, severity: HubItem["severity"] = "critical"): HubItem => ({
  source: "control-center",
  origin: "poll",
  severity,
  text,
});

describe("the hub, end to end", () => {
  let clock = new Date("2026-10-13T10:00:00Z");
  const advance = (minutes: number) => {
    clock = new Date(clock.getTime() + minutes * 60_000);
  };
  const sent: Rendered[] = [];
  let outcome: Delivery = { ok: true };

  beforeEach(() => {
    resetRunningForTests();
    clock = new Date("2026-10-13T10:00:00Z");
    sent.length = 0;
    outcome = { ok: true };
  });

  const make = (over: Partial<HubConfig> = {}, withChannel = true) => {
    const mem = memoryStore();
    const deps: HubDeps = {
      store: mem.store,
      config: config(over),
      now: () => clock,
      send: withChannel
        ? async (message) => {
            sent.push(message);
            return outcome;
          }
        : null,
    };
    return { ...mem, deps };
  };
  const tick = (deps: HubDeps, items: HubItem[]) => runTick(deps, async () => items);

  it("announces a new problem once and then stays quiet", async () => {
    const { deps, rows } = make();
    const first = await tick(deps, [item("Website is down.")]);
    expect(first).toMatchObject({
      ran: true,
      opened: 1,
      sent: 1,
      failed: 0,
      open: 1,
      channel: true,
    });
    expect(sent[0]?.title).toBe("CRITICAL: Website is down.");
    expect(rows[0]?.lastNotifiedAt).not.toBeNull();

    advance(5);
    const second = await tick(deps, [item("Website is down.")]);
    expect(second).toMatchObject({ opened: 0, sent: 0, open: 1 });
    expect(sent).toHaveLength(1);
  });

  it("retries a message that could not be delivered, instead of calling it sent", async () => {
    const { deps, rows } = make();
    outcome = { ok: false, error: "the channel answered 500" };
    const failed = await tick(deps, [item("Website is down.")]);
    expect(failed).toMatchObject({ opened: 1, sent: 0, failed: 1 });
    expect(rows[0]?.lastNotifiedAt).toBeNull();

    advance(5);
    outcome = { ok: true };
    const retried = await tick(deps, [item("Website is down.")]);
    expect(retried).toMatchObject({ opened: 0, sent: 1, failed: 0 });
    expect(rows[0]?.lastNotifiedAt).not.toBeNull();
  });

  it("tracks problems without a channel and announces them once one exists", async () => {
    const quiet = make({ channel: null }, false);
    const none = await tick(quiet.deps, [item("Website is down.")]);
    expect(none).toMatchObject({ ran: true, opened: 1, sent: 0, channel: false, open: 1 });
    expect(quiet.rows[0]?.lastNotifiedAt).toBeNull();

    const now = quiet.deps;
    now.send = async (message) => {
      sent.push(message);
      return { ok: true };
    };
    advance(5);
    const later = await tick(now, [item("Website is down.")]);
    expect(later.sent).toBe(1);
  });

  it("resolves after two clean polls and says so", async () => {
    const { deps, rows } = make();
    await tick(deps, [item("Website is down.")]);
    advance(5);
    const first = await tick(deps, []);
    expect(first).toMatchObject({ resolved: 0, open: 1, sent: 0 });
    advance(5);
    const second = await tick(deps, []);
    expect(second).toMatchObject({ resolved: 1, open: 0, sent: 1 });
    expect(sent.at(-1)?.title).toBe("RESOLVED: Website is down.");
    expect(rows[0]?.state).toBe("resolved");
  });

  it("does not resolve anything when collecting fails", async () => {
    const { deps, rows } = make();
    await tick(deps, [item("Website is down.")]);
    advance(5);
    for (let i = 0; i < 4; i += 1) {
      const out = await runTick(deps, async () => {
        throw new Error("probe exploded");
      });
      expect(out.ran).toBe(false);
    }
    expect(rows[0]).toMatchObject({ state: "open", missedTicks: 0 });
  });

  it("treats a returning problem as a new incident, with history kept", async () => {
    const { deps, rows } = make();
    await tick(deps, [item("Website is down.")]);
    await tick(deps, []);
    await tick(deps, []);
    await tick(deps, [item("Website is down.")]);
    expect(rows.map((r) => r.state)).toEqual(["resolved", "open"]);
    expect(sent.map((s) => s.kind)).toEqual(["opened", "resolved", "opened"]);
  });

  it("sends at most the cap per tick, newest criticals first, and finishes the rest next tick", async () => {
    const { deps } = make({ maxPerTick: 3 });
    const items = [
      item("w1 is slow.", "warning"),
      item("a is down."),
      item("b is down."),
      item("c is down."),
      item("d is down."),
    ];
    const first = await tick(deps, items);
    expect(first).toMatchObject({ opened: 5, sent: 3, deferred: 2 });
    expect(sent.slice(0, 3).every((s) => s.severity === "critical")).toBe(true);
    advance(5);
    const second = await tick(deps, items);
    expect(second.sent).toBe(2);
    expect(sent).toHaveLength(5);
  });

  it("reminds about a long-open critical, but not a warning", async () => {
    const { deps } = make();
    await tick(deps, [item("Website is down."), item("Docs is slow.", "warning")]);
    expect(sent).toHaveLength(2);
    advance(7 * 60);
    await tick(deps, [item("Website is down."), item("Docs is slow.", "warning")]);
    expect(sent.map((s) => s.kind)).toEqual(["opened", "opened", "reminder"]);
    expect(sent.at(-1)?.title).toBe("STILL OPEN: Website is down.");
  });

  it("holds a warning at night and sends it in the morning if it is still there", async () => {
    clock = new Date("2026-10-12T21:30:00Z"); // 23:30 in Warsaw
    const { deps } = make({ quietHours: { start: 23 * 60, end: 7 * 60 } });
    await tick(deps, [item("Docs is slow.", "warning"), item("Website is down.")]);
    expect(sent.map((s) => s.title)).toEqual(["CRITICAL: Website is down."]);
    clock = new Date("2026-10-13T05:30:00Z"); // 07:30 in Warsaw, 8 h after the first message
    await tick(deps, [item("Docs is slow.", "warning"), item("Website is down.")]);
    // The held warning goes out now; the outage is due its 6-hourly reminder too.
    expect(sent.map((s) => s.title)).toEqual([
      "CRITICAL: Website is down.",
      "Warning: Docs is slow.",
      "STILL OPEN: Website is down.",
    ]);
  });

  it("handles pushed events from Grafana: firing, repeated, resolved", async () => {
    const { deps, rows } = make();
    const firing: HubItem = {
      source: "grafana",
      origin: "push",
      severity: "critical",
      text: "Postgres is down",
      detail: "pg_up is 0",
    };
    const open = await processBatch(deps, { polled: null, pushed: [firing] });
    expect(open).toMatchObject({ opened: 1, sent: 1 });
    expect(sent[0]?.message).toContain("pg_up is 0");

    advance(30);
    const again = await processBatch(deps, { polled: null, pushed: [firing] });
    expect(again).toMatchObject({ opened: 0, sent: 0 });

    // A tick does not close a pushed incident just because the Control Center does not list it.
    await tick(deps, []);
    await tick(deps, []);
    expect(rows[0]?.state).toBe("open");

    const resolved = await processBatch(deps, {
      polled: null,
      resolved: [rows[0]!.fingerprint],
    });
    expect(resolved).toMatchObject({ resolved: 1, sent: 1 });
    expect(sent.at(-1)?.kind).toBe("resolved");
  });

  it("pings the heartbeat only after a tick that really ran", async () => {
    const { deps } = make();
    const ping = vi.fn(async () => undefined);
    await runTick(deps, async () => [], ping);
    expect(ping).toHaveBeenCalledTimes(1);
    await runTick(
      deps,
      async () => {
        throw new Error("collect failed");
      },
      ping,
    );
    expect(ping).toHaveBeenCalledTimes(1);
    // A failing heartbeat must never fail the tick.
    const broken = vi.fn(async () => {
      throw new Error("offline");
    });
    expect((await runTick(deps, async () => [], broken)).ran).toBe(true);
  });

  it("refuses to run two ticks at once", async () => {
    const { deps, store } = make();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const slow: Store = { ...store, loadOpen: async () => (await gate, store.loadOpen()) };
    const first = tick({ ...deps, store: slow }, [item("Website is down.")]);
    const second = await tick(deps, [item("Website is down.")]);
    expect(second.ran).toBe(false);
    release();
    expect((await first).ran).toBe(true);
  });

  it("journals what happened and never writes the channel URL anywhere", async () => {
    const { deps, journal } = make();
    outcome = { ok: false, error: "the channel could not be reached" };
    await tick(deps, [item("Website is down.")]);
    outcome = { ok: true };
    await tick(deps, [item("Website is down.")]);
    const events = journal.map((j) => `${j.event}:${j.outcome}`);
    expect(events).toContain("opened:success");
    expect(events).toContain("failed:failure");
    expect(events).toContain("opened:success");
    expect(JSON.stringify(journal)).not.toContain("topic-that-must-never-leak");
    expect(JSON.stringify(sent)).not.toContain("topic-that-must-never-leak");
  });
});
