import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { checkBearer, MIN_TOKEN_LENGTH } from "./auth";
import { buildRequest, deliver, detectFormat, parseChannelUrl } from "./channels";
import { readConfig } from "./config";
import { fingerprint } from "./fingerprint";
import { parseEvents } from "./ingest";
import { isQuiet, minutesInZone, parseQuietHours } from "./quiet-hours";
import { describeAge, redact, render } from "./render";
import type { Notification } from "./types";

const TOKEN = "t".repeat(MIN_TOKEN_LENGTH + 8);

describe("checkBearer", () => {
  it("accepts the right token", () => {
    expect(checkBearer(`Bearer ${TOKEN}`, TOKEN)).toBe("ok");
    expect(checkBearer(`bearer ${TOKEN}`, TOKEN)).toBe("ok");
  });

  it("rejects a missing, malformed or wrong token", () => {
    expect(checkBearer(null, TOKEN)).toBe("unauthorized");
    expect(checkBearer("", TOKEN)).toBe("unauthorized");
    expect(checkBearer(TOKEN, TOKEN)).toBe("unauthorized");
    expect(checkBearer("Bearer wrong", TOKEN)).toBe("unauthorized");
    expect(checkBearer(`Bearer ${TOKEN}x`, TOKEN)).toBe("unauthorized");
    expect(checkBearer(`Basic ${TOKEN}`, TOKEN)).toBe("unauthorized");
  });

  it("is disabled, not open, when no usable token is configured", () => {
    expect(checkBearer(`Bearer ${TOKEN}`, undefined)).toBe("disabled");
    expect(checkBearer(`Bearer ${TOKEN}`, "")).toBe("disabled");
    expect(checkBearer("Bearer short", "short")).toBe("disabled");
  });
});

describe("quiet hours", () => {
  it("parses a window and rejects nonsense", () => {
    expect(parseQuietHours("23:00-07:00")).toEqual({ start: 1380, end: 420 });
    expect(parseQuietHours(" 9:30 - 17:00 ")).toEqual({ start: 570, end: 1020 });
    for (const bad of ["", "nonsense", "25:00-07:00", "23:00-07:60", "07:00-07:00", undefined]) {
      expect(parseQuietHours(bad)).toBeNull();
    }
  });

  it("uses the time zone, not the server clock", () => {
    // 21:30 UTC on 13 Oct 2026 is 23:30 in Warsaw (CEST, UTC+2).
    const night = new Date("2026-10-12T21:30:00Z");
    expect(minutesInZone(night, "Europe/Warsaw")).toBe(23 * 60 + 30);
    expect(minutesInZone(night, "UTC")).toBe(21 * 60 + 30);
  });

  it("covers a window that crosses midnight, with an inclusive start and exclusive end", () => {
    const window = parseQuietHours("23:00-07:00");
    const at = (utc: string) => isQuiet(new Date(utc), window, "Europe/Warsaw");
    expect(at("2026-10-12T20:59:00Z")).toBe(false); // 22:59 local
    expect(at("2026-10-12T21:00:00Z")).toBe(true); // 23:00 local
    expect(at("2026-10-13T02:00:00Z")).toBe(true); // 04:00 local
    expect(at("2026-10-13T04:59:00Z")).toBe(true); // 06:59 local
    expect(at("2026-10-13T05:00:00Z")).toBe(false); // 07:00 local
  });

  it("handles a same-day window and no window", () => {
    const lunch = parseQuietHours("12:00-13:00");
    expect(isQuiet(new Date("2026-10-13T10:30:00Z"), lunch, "Europe/Warsaw")).toBe(true);
    expect(isQuiet(new Date("2026-10-13T12:30:00Z"), lunch, "Europe/Warsaw")).toBe(false);
    expect(isQuiet(new Date(), null, "Europe/Warsaw")).toBe(false);
  });

  it("follows the daylight-saving change", () => {
    const window = parseQuietHours("23:00-07:00");
    // After the clocks go back (25 Oct 2026) Warsaw is UTC+1: 22:30 UTC is 23:30 local.
    expect(isQuiet(new Date("2026-10-26T22:30:00Z"), window, "Europe/Warsaw")).toBe(true);
    expect(isQuiet(new Date("2026-10-26T21:30:00Z"), window, "Europe/Warsaw")).toBe(false);
  });
});

const sample = (over: Partial<Notification> = {}): Notification => ({
  kind: "opened",
  fingerprint: "control-center:website is down.",
  source: "control-center",
  severity: "critical",
  title: "Website is down.",
  since: new Date("2026-10-13T08:00:00Z"),
  ...over,
});
const NOW = new Date("2026-10-13T10:00:00Z");

describe("render", () => {
  it("states severity and how long it has been open", () => {
    const r = render(sample(), NOW, "https://console.example.com/");
    expect(r.title).toBe("CRITICAL: Website is down.");
    expect(r.priority).toBe("high");
    expect(r.message).toContain("Open for 2 h.");
    expect(r.url).toBe("https://console.example.com/admin/control-center");
  });

  it("labels each kind of message", () => {
    expect(render(sample({ severity: "warning" }), NOW).title).toBe("Warning: Website is down.");
    expect(render(sample({ kind: "reminder" }), NOW).title).toBe("STILL OPEN: Website is down.");
    expect(render(sample({ kind: "escalated" }), NOW).title).toBe(
      "ESCALATED to critical: Website is down.",
    );
    const resolved = render(sample({ kind: "resolved" }), NOW);
    expect(resolved.title).toBe("RESOLVED: Website is down.");
    expect(resolved.priority).toBe("low");
    expect(resolved.message).toContain("It lasted 2 h.");
  });

  it("describes ages in sensible units", () => {
    const base = new Date("2026-10-13T10:00:00Z");
    expect(describeAge(new Date(base.getTime() - 5 * 60_000), base)).toBe("5 min");
    expect(describeAge(new Date(base.getTime() - 3 * 3_600_000), base)).toBe("3 h");
    expect(describeAge(new Date(base.getTime() - 72 * 3_600_000), base)).toBe("3 days");
  });

  it("never lets a secret-shaped value leave", () => {
    const leaked = ["sk", "live", "abcdefghijklmnopqrstuvwxyz0123456789"].join("_");
    const r = render(sample({ title: `Bad ${leaked}`, detail: `token ${leaked}` }), NOW);
    expect(r.title).not.toContain(leaked);
    expect(r.message).not.toContain(leaked);
    expect(redact(`x ${leaked} y`)).toBe("x [redacted] y");
  });
});

describe("channels", () => {
  it("only accepts a plain https URL", () => {
    expect(parseChannelUrl("https://ntfy.sh/topic")).toBeInstanceOf(URL);
    for (const bad of [
      undefined,
      "",
      "not a url",
      "http://ntfy.sh/topic",
      "https://user:pass@ntfy.sh/topic",
      "ftp://x.example/y",
    ]) {
      expect(parseChannelUrl(bad)).toBeNull();
    }
  });

  it("picks the format from the host, unless told otherwise", () => {
    const f = (u: string, o?: string) => detectFormat(new URL(u), o);
    expect(f("https://ntfy.sh/x")).toBe("ntfy");
    expect(f("https://discord.com/api/webhooks/1/2")).toBe("discord");
    expect(f("https://hooks.slack.com/services/a/b")).toBe("slack");
    expect(f("https://hooks.example.com/x")).toBe("generic");
    expect(f("https://hooks.example.com/x", "ntfy")).toBe("ntfy");
    expect(f("https://hooks.example.com/x", "bogus")).toBe("generic");
  });

  it("builds an ntfy request with plain-ASCII headers", () => {
    const r = render(sample({ title: "Zażółć gęślą jaźń down." }), NOW, "https://c.example");
    const { headers, body } = buildRequest("ntfy", r);
    expect(headers.Title).toMatch(/^[\x20-\x7e]+$/);
    expect(headers.Priority).toBe("high");
    expect(headers.Tags).toBe("rotating_light");
    expect(headers.Click).toBe("https://c.example/admin/control-center");
    expect(body).toContain("Open for");
  });

  it("builds Discord, Slack and generic JSON bodies", () => {
    const r = render(sample(), NOW);
    expect(JSON.parse(buildRequest("discord", r).body).content).toContain("CRITICAL");
    expect(JSON.parse(buildRequest("slack", r).body).text).toContain("CRITICAL");
    expect(JSON.parse(buildRequest("generic", r).body)).toMatchObject({
      severity: "critical",
      kind: "opened",
      source: "control-center",
    });
  });

  it("delivers, and refuses redirects and slow servers", async () => {
    const r = render(sample(), NOW);
    const fetchImpl = vi.fn(async () => new Response("ok", { status: 200 }));
    const out = await deliver({ url: "https://ntfy.sh/topic-secret" }, r, fetchImpl as never);
    expect(out).toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect((fetchImpl.mock.calls[0] as unknown[])[1]).toMatchObject({
      method: "POST",
      redirect: "error",
    });
  });

  it("reports failures without ever echoing the URL", async () => {
    const r = render(sample(), NOW);
    const url = "https://ntfy.sh/topic-secret-123";
    const refused = vi.fn(async () => new Response("no", { status: 403 }));
    const a = await deliver({ url }, r, refused as never);
    expect(a).toEqual({ ok: false, error: "the channel answered 403" });

    const boom = vi.fn(async () => {
      throw new Error(`connect ECONNREFUSED ${url}`);
    });
    const b = await deliver({ url }, r, boom as never);
    expect(b.ok).toBe(false);
    expect(JSON.stringify(b)).not.toContain("topic-secret");

    const slow = vi.fn(async () => {
      const error = new Error("The operation timed out");
      error.name = "TimeoutError";
      throw error;
    });
    expect(await deliver({ url }, r, slow as never)).toEqual({
      ok: false,
      error: "the channel timed out",
    });
  });

  it("does not call out for a bad URL", async () => {
    const fetchImpl = vi.fn();
    const out = await deliver(
      { url: "http://insecure.example/x" },
      render(sample(), NOW),
      fetchImpl as never,
    );
    expect(out.ok).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("parseEvents", () => {
  const grafana = (alerts: unknown[]) => ({ receiver: "nexora-hub", status: "firing", alerts });

  it("reads a Grafana firing and resolved payload", () => {
    const parsed = parseEvents(
      grafana([
        {
          status: "firing",
          labels: { alertname: "Postgres is down" },
          annotations: { summary: "pg_up is 0" },
        },
        {
          status: "firing",
          labels: { alertname: "Redis memory usage high", severity: "warning" },
          annotations: {},
        },
        { status: "resolved", labels: { alertname: "Root disk space low" }, annotations: {} },
      ]),
    );
    expect(parsed?.items).toEqual([
      {
        source: "grafana",
        origin: "push",
        severity: "critical",
        text: "Postgres is down",
        detail: "pg_up is 0",
      },
      {
        source: "grafana",
        origin: "push",
        severity: "warning",
        text: "Redis memory usage high",
        detail: undefined,
      },
    ]);
    expect(parsed?.resolved).toEqual([fingerprint("grafana", "Root disk space low")]);
  });

  it("reads a real Grafana 13 webhook captured from the provisioned contact point", () => {
    const real = JSON.parse(
      readFileSync(new URL("./fixtures/grafana-firing.json", import.meta.url), "utf8"),
    );
    // The same payload the hub will receive in production: receiver name, groupKey, alerts[].
    expect(real.status).toBe("firing");
    expect(parseEvents(real)).toEqual({
      items: [
        {
          source: "grafana",
          origin: "push",
          severity: "critical",
          text: "Postgres is down",
          detail: "postgres-exporter reports pg_up=0 — Postgres is unreachable.",
        },
      ],
      resolved: [],
    });
    const resolved = {
      ...real,
      status: "resolved",
      alerts: real.alerts.map((a: object) => ({ ...a, status: "resolved" })),
    };
    expect(parseEvents(resolved)?.resolved).toEqual([fingerprint("grafana", "Postgres is down")]);
  });

  it("reads a generic event and an events array", () => {
    expect(
      parseEvents({ source: "backup", title: "Backup is late", severity: "critical" })?.items,
    ).toMatchObject([{ source: "backup", severity: "critical", text: "Backup is late" }]);
    const many = parseEvents({
      events: [
        { source: "backup", title: "Backup is late" },
        { source: "backup", title: "Backup is late", status: "resolved" },
      ],
    });
    expect(many?.items).toHaveLength(1);
    expect(many?.items[0]?.severity).toBe("warning");
    expect(many?.resolved).toEqual([fingerprint("backup", "Backup is late")]);
  });

  it("refuses anything it does not understand", () => {
    for (const bad of [
      null,
      "text",
      42,
      [],
      {},
      { source: "Bad Source!", title: "x" },
      { source: "ok", title: "" },
      { source: "ok" },
      grafana([{ status: "firing", labels: {}, annotations: {} }]),
      grafana(["not an object", null]),
    ]) {
      expect(parseEvents(bad)).toBeNull();
    }
  });

  it("caps how many events one request can carry and how long a text can be", () => {
    const events = Array.from({ length: 200 }, (_, i) => ({
      source: "load",
      title: `Alert ${"x".repeat(500)} ${i}`,
    }));
    const parsed = parseEvents({ events });
    expect(parsed?.items).toHaveLength(50);
    expect(parsed?.items[0]?.text.length).toBeLessThanOrEqual(200);
  });
});

describe("readConfig", () => {
  it("has safe defaults and no channel", () => {
    const c = readConfig({});
    expect(c.channel).toBeNull();
    expect(c.quietHours).toBeNull();
    expect(c.timeZone).toBe("Europe/Warsaw");
    expect(c.reconcile.reminderMs).toBe(6 * 3_600_000);
    expect(c.maxPerTick).toBe(10);
    expect(c.heartbeatUrl).toBeNull();
  });

  it("reads settings and ignores out-of-range numbers", () => {
    const c = readConfig({
      OPS_NOTIFY_WEBHOOK_URL: " https://ntfy.sh/t ",
      OPS_NOTIFY_FORMAT: "ntfy",
      OPS_QUIET_HOURS: "22:00-06:30",
      OPS_REMINDER_HOURS: "2",
      OPS_RESOLVE_AFTER_MISSED: "99",
      OPS_NOTIFY_MAX_PER_TICK: "abc",
      OPS_HEARTBEAT_URL: "https://hc-ping.com/x",
    });
    expect(c.channel).toEqual({ url: "https://ntfy.sh/t", format: "ntfy" });
    expect(c.quietHours).toEqual({ start: 1320, end: 390 });
    expect(c.reconcile.reminderMs).toBe(2 * 3_600_000);
    expect(c.reconcile.resolveAfterMissed).toBe(2);
    expect(c.maxPerTick).toBe(10);
    expect(c.heartbeatUrl).toBe("https://hc-ping.com/x");
  });

  it("falls back to the default zone when the zone is invalid, so a typo cannot switch alerting off", () => {
    expect(readConfig({ OPS_QUIET_TZ: "Europe/Warsw" }).timeZone).toBe("Europe/Warsaw");
    expect(readConfig({ OPS_QUIET_TZ: "   " }).timeZone).toBe("Europe/Warsaw");
    expect(readConfig({ OPS_QUIET_TZ: "UTC" }).timeZone).toBe("UTC");
    expect(readConfig({ OPS_QUIET_TZ: " America/New_York " }).timeZone).toBe("America/New_York");
    // The fallback is usable: quiet-hours maths still works with it.
    const config = readConfig({ OPS_QUIET_TZ: "Not/AZone", OPS_QUIET_HOURS: "23:00-07:00" });
    expect(() => isQuiet(new Date(), config.quietHours, config.timeZone)).not.toThrow();
  });
});
