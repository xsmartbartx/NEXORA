import { beforeEach, describe, expect, it, vi } from "vitest";

const inserted: { values: unknown[]; target: unknown } = { values: [], target: null };
let conflictIds = new Set<string>();

vi.mock("@nexora/database", () => ({
  auditEvents: { id: "id", orgId: "org_id", externalId: "external_id" },
  db: {
    insert: () => ({
      values: (rows: { externalId: string }[]) => {
        inserted.values = rows;
        return {
          onConflictDoNothing: ({ target }: { target: unknown }) => {
            inserted.target = target;
            return {
              returning: async () =>
                rows
                  .filter((r) => !conflictIds.has(r.externalId))
                  .map((_, i) => ({ id: `id${i}` })),
            };
          },
        };
      },
    }),
  },
}));

import {
  ingestNeurawallEvents,
  MAX_EVENTS_PER_REQUEST,
  parseNeurawallEvents,
} from "./neurawall-events";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const event = (over: Record<string, unknown> = {}) => ({
  event_id: id(1),
  type: "neurawall.alert.created",
  ts: 1793000000.2,
  data: { severity: "high" },
  ...over,
});

describe("parseNeurawallEvents", () => {
  it("accepts every event type NeuraWall sends", () => {
    const events = [
      event(),
      event({ event_id: id(2), type: "neurawall.rule.approved", data: { mode: "enforce" } }),
      event({
        event_id: id(3),
        type: "neurawall.bundle.published",
        data: { version: 3, rules: 12 },
      }),
      event({ event_id: id(4), type: "neurawall.bundle.rolled_back", data: { version: 2 } }),
      event({ event_id: id(5), type: "neurawall.node.enrolled", data: {} }),
      event({ event_id: id(6), type: "neurawall.node.revoked", data: {} }),
      event({
        event_id: id(7),
        type: "neurawall.llm.call",
        data: { kind: "triage", outcome: "ok" },
      }),
      event({ event_id: id(8), type: "neurawall.flows.ingested", data: { count: 4200 } }),
    ];
    const result = parseNeurawallEvents({ events });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.events).toHaveLength(8);
  });

  it.each([
    ["not an object", [event()]],
    ["extra top-level field", { events: [event()], extra: 1 }],
    ["no events", { events: [] }],
    ["events not an array", { events: "x" }],
  ])("rejects a body that is %s", (_name, body) => {
    expect(parseNeurawallEvents(body).ok).toBe(false);
  });

  it(`rejects more than ${MAX_EVENTS_PER_REQUEST} events`, () => {
    const events = Array.from({ length: MAX_EVENTS_PER_REQUEST + 1 }, (_, n) =>
      event({ event_id: id(n + 1) }),
    );
    expect(parseNeurawallEvents({ events }).ok).toBe(false);
    expect(parseNeurawallEvents({ events: events.slice(0, MAX_EVENTS_PER_REQUEST) }).ok).toBe(true);
  });

  it.each([
    ["unknown event type", event({ type: "neurawall.alert.deleted" })],
    ["another product's action", event({ type: "sentinel.scan.completed" })],
    ["a prototype-chain type", event({ type: "constructor" })],
    ["missing event_id", event({ event_id: undefined })],
    ["event_id not a uuid", event({ event_id: "abc" })],
    ["ts as a string", event({ ts: "1793000000" })],
    ["negative ts", event({ ts: -1 })],
    ["infinite ts", event({ ts: Infinity })],
    ["unknown event field", event({ actor: "root" })],
    ["data missing", event({ data: undefined })],
    ["data an array", event({ data: [] })],
  ])("rejects an event with %s", (_name, bad) => {
    expect(parseNeurawallEvents({ events: [bad] }).ok).toBe(false);
  });

  it.each([
    ["an address", event({ data: { severity: "high", src_ip: "10.0.0.5" } })],
    ["an email", event({ data: { severity: "high", user: "a@b.co" } })],
    ["a prototype key", event({ data: { constructor: "x" } })],
    ["a free-text severity", event({ data: { severity: "very bad" } })],
    ["a numeric severity", event({ data: { severity: 3 } })],
    ["a negative count", event({ type: "neurawall.flows.ingested", data: { count: -1 } })],
    ["a fractional count", event({ type: "neurawall.flows.ingested", data: { count: 1.5 } })],
    ["a count as a string", event({ type: "neurawall.flows.ingested", data: { count: "5" } })],
    ["an unsafe integer", event({ type: "neurawall.flows.ingested", data: { count: 2 ** 60 } })],
    [
      "a field of another type",
      event({ type: "neurawall.node.enrolled", data: { severity: "high" } }),
    ],
  ])("keeps %s out: the data contract is closed", (_name, bad) => {
    const result = parseNeurawallEvents({ events: [bad] });
    expect(result.ok).toBe(false);
  });

  it("names the offending event in the error", () => {
    const result = parseNeurawallEvents({ events: [event(), event({ type: "x" })] });
    expect(result).toEqual({ ok: false, message: expect.stringContaining("events[1]") });
  });
});

describe("ingestNeurawallEvents", () => {
  beforeEach(() => {
    inserted.values = [];
    inserted.target = null;
    conflictIds = new Set();
  });

  const parsed = (n: number) => {
    const r = parseNeurawallEvents({
      events: Array.from({ length: n }, (_, i) => event({ event_id: id(i + 1) })),
    });
    if (!r.ok) throw new Error(r.message);
    return r.events;
  };

  it("writes org-scoped rows stamped with the key, never the sender's data as columns", async () => {
    await ingestNeurawallEvents("org_1", "key_9", parsed(1));
    expect(inserted.values).toEqual([
      {
        orgId: "org_1",
        actorId: "apikey:key_9",
        action: "neurawall.alert.created",
        resourceType: "neurawall",
        outcome: "success",
        metadata: { data: { severity: "high" }, source_ts: 1793000000.2 },
        externalId: id(1),
      },
    ]);
  });

  it("is idempotent: ids Core already has are counted as duplicates", async () => {
    conflictIds = new Set([id(1), id(2)]);
    expect(await ingestNeurawallEvents("org_1", "k", parsed(5))).toEqual({
      stored: 3,
      duplicates: 2,
    });
  });

  it("targets the per-organisation unique index, so another org's ids never collide", async () => {
    await ingestNeurawallEvents("org_1", "k", parsed(1));
    expect(inserted.target).toEqual([expect.objectContaining({}), expect.objectContaining({})]);
  });

  it("collapses an id repeated inside one request before writing", async () => {
    const same = parsed(1)[0]!;
    const result = await ingestNeurawallEvents("org_1", "k", [same, same, same]);
    expect(inserted.values).toHaveLength(1);
    expect(result).toEqual({ stored: 1, duplicates: 2 });
  });
});
