import { auditEvents, db } from "@nexora/database";

/**
 * C-EVENT for NeuraWall, an independently hosted product: usage events it
 * reports over `POST /v1/events`. Counts and ids only. The contract is closed:
 * a fixed list of event types, a fixed list of fields per type, each with a
 * fixed shape, and anything else is rejected rather than stored. That keeps a
 * misbehaving or compromised installation from writing arbitrary rows (or
 * another product's action names) into the audit trail, and keeps addresses,
 * emails and other personal data out of Core by construction.
 */
export const MAX_EVENTS_PER_REQUEST = 100;
export const MAX_BODY_BYTES = 256 * 1024;

type FieldRule = { kind: "enum"; values: readonly string[] } | { kind: "count" };

const SEVERITIES = ["low", "medium", "high", "critical"] as const;

const EVENT_TYPES: Record<string, Record<string, FieldRule>> = {
  "neurawall.alert.created": { severity: { kind: "enum", values: SEVERITIES } },
  "neurawall.rule.approved": { mode: { kind: "enum", values: ["enforce", "alert_only"] } },
  "neurawall.bundle.published": { version: { kind: "count" }, rules: { kind: "count" } },
  "neurawall.bundle.rolled_back": { version: { kind: "count" } },
  "neurawall.node.enrolled": {},
  "neurawall.node.revoked": {},
  "neurawall.llm.call": {
    kind: { kind: "enum", values: ["triage", "draft", "narrate", "explain"] },
    outcome: { kind: "enum", values: ["ok", "refused", "error"] },
  },
  "neurawall.flows.ingested": { count: { kind: "count" } },
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface NeurawallEvent {
  eventId: string;
  type: string;
  /** The sender's clock, seconds. Kept as metadata only; Core stamps its own time. */
  sourceTs: number;
  data: Record<string, string | number>;
}

export type ParseResult = { ok: true; events: NeurawallEvent[] } | { ok: false; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

type Checked<T> = { ok: true; value: T } | { ok: false; message: string };

const fail = (message: string): { ok: false; message: string } => ({ ok: false, message });

/** One `data` object against the field rules of its event type. */
function parseData(
  data: Record<string, unknown>,
  rules: Record<string, FieldRule>,
  at: string,
): Checked<Record<string, string | number>> {
  const clean: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(data)) {
    const rule = Object.hasOwn(rules, key) ? rules[key] : undefined;
    if (!rule) return fail(`${at}.data has an unknown field "${key}".`);
    const valid =
      rule.kind === "enum"
        ? typeof value === "string" && rule.values.includes(value)
        : typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
    if (!valid) {
      return fail(
        rule.kind === "enum"
          ? `${at}.data.${key} is not an allowed value.`
          : `${at}.data.${key} must be a non-negative integer.`,
      );
    }
    clean[key] = value as string | number;
  }
  return { ok: true, value: clean };
}

/** One element of `events`. */
function parseEvent(item: unknown, at: string): Checked<NeurawallEvent> {
  if (!isRecord(item)) return fail(`${at} must be an object.`);
  const unknownKey = Object.keys(item).find((k) => !["event_id", "type", "ts", "data"].includes(k));
  if (unknownKey) return fail(`${at} has an unknown field "${unknownKey}".`);

  const { event_id: eventId, type, ts, data } = item;
  if (typeof eventId !== "string" || !UUID.test(eventId)) {
    return fail(`${at}.event_id must be a UUID.`);
  }
  if (typeof type !== "string" || !Object.hasOwn(EVENT_TYPES, type)) {
    return fail(`${at}.type is not a known NeuraWall event.`);
  }
  if (typeof ts !== "number" || !Number.isFinite(ts) || ts < 0) {
    return fail(`${at}.ts must be a non-negative number of seconds.`);
  }
  if (!isRecord(data)) return fail(`${at}.data must be an object.`);

  const parsed = parseData(data, EVENT_TYPES[type] as Record<string, FieldRule>, at);
  if (!parsed.ok) return parsed;
  return { ok: true, value: { eventId, type, sourceTs: ts, data: parsed.value } };
}

/** Strict, pure validation of a decoded `POST /v1/events` body. */
export function parseNeurawallEvents(body: unknown): ParseResult {
  if (!isRecord(body) || Object.keys(body).some((k) => k !== "events")) {
    return fail('Body must be {"events": [...]}.');
  }
  const raw = body.events;
  if (!Array.isArray(raw) || raw.length === 0) return fail('"events" must be a non-empty array.');
  if (raw.length > MAX_EVENTS_PER_REQUEST) {
    return fail(`At most ${MAX_EVENTS_PER_REQUEST} events per request.`);
  }

  const events: NeurawallEvent[] = [];
  for (const [i, item] of raw.entries()) {
    const parsed = parseEvent(item, `events[${i}]`);
    if (!parsed.ok) return parsed;
    events.push(parsed.value);
  }
  return { ok: true, events };
}

export interface IngestResult {
  stored: number;
  duplicates: number;
}

/**
 * Writes the events in one statement (all or nothing). Idempotent on
 * `(org_id, external_id)`: an event id Core has already stored for this
 * organisation is skipped, so a retry after a timeout never doubles a count.
 */
export async function ingestNeurawallEvents(
  orgId: string,
  keyId: string,
  events: NeurawallEvent[],
): Promise<IngestResult> {
  const unique = [...new Map(events.map((e) => [e.eventId, e])).values()];
  const inserted = await db
    .insert(auditEvents)
    .values(
      unique.map((e) => ({
        orgId,
        actorId: `apikey:${keyId}`,
        action: e.type,
        resourceType: "neurawall",
        outcome: "success" as const,
        metadata: { data: e.data, source_ts: e.sourceTs },
        externalId: e.eventId,
      })),
    )
    .onConflictDoNothing({ target: [auditEvents.orgId, auditEvents.externalId] })
    .returning({ id: auditEvents.id });
  return { stored: inserted.length, duplicates: events.length - inserted.length };
}
