import { fingerprint } from "./fingerprint";
import type { HubItem, Severity } from "./types";

export interface ParsedEvents {
  /** Reported as firing. */
  items: HubItem[];
  /** Fingerprints reported as resolved. */
  resolved: string[];
}

const MAX_EVENTS = 50;
const SOURCE = /^[a-z0-9][a-z0-9._-]{0,39}$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const text = (value: unknown, max: number): string | null =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;

const severityOf = (value: unknown, fallback: Severity): Severity =>
  value === "warning" || value === "critical" ? value : fallback;

/**
 * Grafana's webhook contact point posts `{ status, alerts: [{ status, labels, annotations }] }`.
 * The alert name is the identity; a missing `severity` label means critical, because a rule
 * that fires should be taken seriously unless someone says otherwise.
 */
function parseGrafana(body: Record<string, unknown>): ParsedEvents {
  const out: ParsedEvents = { items: [], resolved: [] };
  const alerts = Array.isArray(body.alerts) ? body.alerts.slice(0, MAX_EVENTS) : [];
  for (const alert of alerts) {
    if (!isRecord(alert)) continue;
    const labels = isRecord(alert.labels) ? alert.labels : {};
    const annotations = isRecord(alert.annotations) ? alert.annotations : {};
    const title = text(labels.alertname, 200);
    if (!title) continue;
    if (alert.status === "resolved") {
      out.resolved.push(fingerprint("grafana", title));
    } else {
      out.items.push({
        source: "grafana",
        origin: "push",
        severity: severityOf(labels.severity, "critical"),
        text: title,
        detail: text(annotations.summary, 500) ?? undefined,
      });
    }
  }
  return out;
}

/** `{ source, title, severity?, detail?, status?: "firing" | "resolved" }`, one or an array under `events`. */
function parseGeneric(body: Record<string, unknown>): ParsedEvents {
  const out: ParsedEvents = { items: [], resolved: [] };
  const events = Array.isArray(body.events) ? body.events.slice(0, MAX_EVENTS) : [body];
  for (const event of events) {
    if (!isRecord(event)) continue;
    const source = text(event.source, 40);
    const title = text(event.title, 200);
    if (!source || !SOURCE.test(source) || !title) continue;
    if (event.status === "resolved") {
      out.resolved.push(fingerprint(source, title));
    } else {
      out.items.push({
        source,
        origin: "push",
        severity: severityOf(event.severity, "warning"),
        text: title,
        detail: text(event.detail, 500) ?? undefined,
      });
    }
  }
  return out;
}

/** Returns null when the body is not something the hub understands. */
export function parseEvents(body: unknown): ParsedEvents | null {
  if (!isRecord(body)) return null;
  const grafana = Array.isArray(body.alerts) && ("receiver" in body || "groupKey" in body);
  const parsed = grafana ? parseGrafana(body) : parseGeneric(body);
  return parsed.items.length + parsed.resolved.length > 0 ? parsed : null;
}
