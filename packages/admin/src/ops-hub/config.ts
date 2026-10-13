import { parseQuietHours, type QuietWindow } from "./quiet-hours";
import { DEFAULT_RECONCILE, type ReconcileConfig } from "./types";
import type { ChannelConfig } from "./channels";

export interface HubConfig {
  /** Shared secret for the internal endpoints; unset or weak means the endpoints do not exist. */
  token: string | undefined;
  /** Where messages go; null means alerts are tracked and journalled but nothing is sent. */
  channel: ChannelConfig | null;
  quietHours: QuietWindow | null;
  timeZone: string;
  reconcile: ReconcileConfig;
  /** A cap on messages per tick, so one bad hour cannot flood a phone. */
  maxPerTick: number;
  consoleUrl: string;
  /** An external "dead man's switch" pinged after every successful tick (healthchecks.io style). */
  heartbeatUrl: string | null;
}

type Env = Record<string, string | undefined>;

/** A whole number inside [min, max], else the fallback. Never trust an environment variable to be sane. */
function bounded(raw: string | undefined, min: number, max: number, fallback: number): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
}

export function readConfig(env: Env = process.env): HubConfig {
  const channelUrl = env.OPS_NOTIFY_WEBHOOK_URL?.trim();
  return {
    token: env.OPS_HUB_TOKEN,
    channel: channelUrl ? { url: channelUrl, format: env.OPS_NOTIFY_FORMAT?.trim() } : null,
    quietHours: parseQuietHours(env.OPS_QUIET_HOURS),
    timeZone: env.OPS_QUIET_TZ?.trim() || "Europe/Warsaw",
    reconcile: {
      reminderMs:
        bounded(env.OPS_REMINDER_HOURS, 1, 72, DEFAULT_RECONCILE.reminderMs / 3_600_000) *
        3_600_000,
      resolveAfterMissed: bounded(
        env.OPS_RESOLVE_AFTER_MISSED,
        1,
        10,
        DEFAULT_RECONCILE.resolveAfterMissed,
      ),
      pushTtlMs:
        bounded(env.OPS_PUSH_TTL_HOURS, 1, 168, DEFAULT_RECONCILE.pushTtlMs / 3_600_000) *
        3_600_000,
    },
    maxPerTick: bounded(env.OPS_NOTIFY_MAX_PER_TICK, 1, 50, 10),
    consoleUrl: env.NEXT_PUBLIC_CONSOLE_URL ?? "https://console.onenexora.com",
    heartbeatUrl: env.OPS_HEARTBEAT_URL?.trim() || null,
  };
}
