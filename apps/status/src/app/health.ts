import type { ComponentStatus, StatusComponent } from "./components";

export interface ComponentResult {
  name: string;
  description: string;
  status: ComponentStatus;
  /** Round-trip time of the successful attempt; null when down or not probed. */
  latencyMs: number | null;
}

export interface StatusSnapshot {
  checkedAt: Date;
  components: ComponentResult[];
}

const TIMEOUT_MS = 5_000;
/** Slower than this but still answering reads as degraded, not down. */
const SLOW_MS = 2_500;
/** Serve one snapshot to every visitor for this long — a page view never fans out to N probes. */
const CACHE_MS = 30_000;

/**
 * 2xx/3xx is up. Redirects are deliberately not followed: signed-out app
 * pages 307 to Clerk's hosted sign-in, which isn't ours to monitor and
 * answers automated clients with a Cloudflare 403.
 */
async function attempt(url: string): Promise<number | null> {
  const started = Date.now();
  try {
    const response = await fetch(url, {
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return response.status < 400 ? Date.now() - started : null;
  } catch {
    return null;
  }
}

/** One retry, so a single dropped connection doesn't flash "Down" publicly. */
export async function probe(component: StatusComponent): Promise<ComponentResult> {
  const base = { name: component.name, description: component.description };
  if (!component.checkUrl) return { ...base, status: "operational", latencyMs: null };

  const latencyMs = (await attempt(component.checkUrl)) ?? (await attempt(component.checkUrl));
  if (latencyMs === null) return { ...base, status: "down", latencyMs: null };
  return { ...base, status: latencyMs > SLOW_MS ? "degraded" : "operational", latencyMs };
}

export function overallStatus(results: ComponentResult[]): ComponentStatus {
  if (results.some((r) => r.status === "down")) return "down";
  if (results.some((r) => r.status === "degraded")) return "degraded";
  return "operational";
}

let cached: { at: number; snapshot: Promise<StatusSnapshot> } | null = null;

export function getStatusSnapshot(
  components: StatusComponent[],
  now: number = Date.now(),
): Promise<StatusSnapshot> {
  if (cached && now - cached.at < CACHE_MS) return cached.snapshot;
  const snapshot = Promise.all(components.map(probe)).then((results) => ({
    checkedAt: new Date(now),
    components: results,
  }));
  cached = { at: now, snapshot };
  return snapshot;
}

/** Test-only: drop the cached snapshot. */
export function resetStatusCache() {
  cached = null;
}
