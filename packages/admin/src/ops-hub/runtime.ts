import { attentionItems } from "../control-center/attention";
import { collectControlCenter } from "../control-center";
import { deliver, parseChannelUrl } from "./channels";
import { readConfig, type HubConfig } from "./config";
import { isNoise } from "./fingerprint";
import { parseEvents } from "./ingest";
import { createDbStore } from "./store";
import { processBatch, runTick, type HubDeps, type Summary } from "./tick";
import type { HubItem } from "./types";

function buildDeps(config: HubConfig): HubDeps {
  const channel = config.channel;
  return {
    store: createDbStore(),
    config,
    now: () => new Date(),
    send: channel && parseChannelUrl(channel.url) ? (message) => deliver(channel, message) : null,
  };
}

/** What the Control Center says is wrong right now, minus the items that belong on the page only. */
async function collectPolled(): Promise<HubItem[]> {
  const snapshot = await collectControlCenter();
  return attentionItems(snapshot)
    .map((item) => ({
      source: "control-center",
      origin: "poll" as const,
      severity: item.level,
      text: item.text,
    }))
    .filter((item) => !isNoise(item));
}

/** A heartbeat ping: lets an outside service notice if this hub itself stops running. */
function pinger(url: string | null): (() => Promise<void>) | undefined {
  if (!url) return undefined;
  return async () => {
    await fetch(url, { method: "GET", signal: AbortSignal.timeout(8_000), redirect: "error" });
  };
}

export async function runHubTick(): Promise<Summary> {
  const config = readConfig();
  return runTick(buildDeps(config), collectPolled, pinger(config.heartbeatUrl));
}

/** Returns null when the body is not an event the hub understands. */
export async function receiveHubEvents(body: unknown): Promise<Summary | null> {
  const parsed = parseEvents(body);
  if (!parsed) return null;
  return processBatch(buildDeps(readConfig()), {
    polled: null,
    pushed: parsed.items,
    resolved: parsed.resolved,
  });
}
