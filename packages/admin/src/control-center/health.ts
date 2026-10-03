import { sql } from "drizzle-orm";
import { db } from "@nexora/database";
import { ENDPOINTS, BACKUP_URL, type Endpoint } from "./endpoints";
import { NotConnected, timedFetch } from "./result";

export type EndpointStatus = "up" | "degraded" | "down";

export interface EndpointResult extends Endpoint {
  status: EndpointStatus;
  httpStatus: number | null;
  latencyMs: number | null;
}

/** Slower than this but answering reads as degraded, not down — same threshold apps/status uses. */
export const SLOW_MS = 2_500;

type Fetcher = (url: string, init?: RequestInit, timeoutMs?: number) => Promise<Response>;

async function attempt(
  url: string,
  fetcher: Fetcher,
): Promise<{ httpStatus: number | null; latencyMs: number | null }> {
  const started = Date.now();
  try {
    // Redirects aren't followed: signed-out app pages 307 to Clerk's hosted
    // sign-in, which isn't ours to monitor and answers bots with a 403.
    const response = await fetcher(url, { redirect: "manual" }, 5_000);
    return {
      httpStatus: response.status,
      latencyMs: response.status < 400 ? Date.now() - started : null,
    };
  } catch {
    return { httpStatus: null, latencyMs: null };
  }
}

/** One retry, so a single dropped connection doesn't flash "down". */
export async function probeEndpoint(
  endpoint: Endpoint,
  fetcher: Fetcher = timedFetch,
): Promise<EndpointResult> {
  let result = await attempt(endpoint.url, fetcher);
  if (result.latencyMs === null) result = await attempt(endpoint.url, fetcher);

  if (result.latencyMs === null) return { ...endpoint, status: "down", ...result };
  return { ...endpoint, status: result.latencyMs > SLOW_MS ? "degraded" : "up", ...result };
}

export function probeAll(fetcher: Fetcher = timedFetch): Promise<EndpointResult[]> {
  return Promise.all(ENDPOINTS.map((endpoint) => probeEndpoint(endpoint, fetcher)));
}

export interface BackupStatus {
  status: "ok" | "stale" | "missing";
  lastSuccess: string | null;
}

/** The status app's own freshness endpoint: 503 once the nightly backup, off-site upload included, is >26h old. */
export async function collectBackup(): Promise<BackupStatus> {
  const response = await timedFetch(BACKUP_URL);
  const body: unknown = await response.json();
  if (
    typeof body === "object" &&
    body !== null &&
    "status" in body &&
    (body.status === "ok" || body.status === "stale" || body.status === "missing")
  ) {
    const lastSuccess =
      "lastSuccess" in body && typeof body.lastSuccess === "string" ? body.lastSuccess : null;
    return { status: body.status, lastSuccess };
  }
  throw new Error("unexpected backup status response");
}

export interface PrometheusSample {
  metric: Record<string, string>;
  value: number;
}

/** Parses a Prometheus instant-query response; anything unexpected is an error, never a silent 0. */
export function parseInstantQuery(body: unknown): PrometheusSample[] {
  const data =
    typeof body === "object" && body !== null && "data" in body
      ? (body as { data?: { result?: unknown } }).data
      : undefined;
  if (!data || !Array.isArray(data.result)) throw new Error("unexpected Prometheus response");

  return data.result.map((entry: unknown) => {
    const { metric, value } = entry as {
      metric?: Record<string, string>;
      value?: [number, string];
    };
    const parsed = Number(value?.[1]);
    if (!metric || !Number.isFinite(parsed)) throw new Error("unexpected Prometheus sample");
    return { metric, value: parsed };
  });
}

async function promQuery(baseUrl: string, query: string): Promise<PrometheusSample[]> {
  const response = await timedFetch(`${baseUrl}/api/v1/query?query=${encodeURIComponent(query)}`);
  if (!response.ok) throw new Error(`Prometheus answered ${response.status}`);
  return parseInstantQuery(await response.json());
}

export interface InfraMetrics {
  /** Scrape targets that are not up — an exporter being down means the numbers below are missing, not zero. */
  targetsDown: string[];
  postgresUp: boolean | null;
  redisUp: boolean | null;
  cpuPercent: number | null;
  memoryPercent: number | null;
  /** Free space on the root filesystem. */
  diskFreePercent: number | null;
  redisMemoryPercent: number | null;
  postgresConnections: number | null;
}

const first = (samples: PrometheusSample[]) => samples[0]?.value ?? null;

/** Host, Postgres and Redis metrics from the in-cluster Prometheus (infrastructure/docker/monitoring). */
export async function collectInfraMetrics(): Promise<InfraMetrics> {
  const baseUrl = process.env.PROMETHEUS_URL;
  if (!baseUrl) {
    throw new NotConnected(
      "Prometheus",
      "Set PROMETHEUS_URL (http://prometheus:9090 inside the compose network).",
    );
  }

  const [up, pg, redis, cpu, mem, disk, redisMem, conns] = await Promise.all([
    promQuery(baseUrl, "up"),
    promQuery(baseUrl, "pg_up"),
    promQuery(baseUrl, "redis_up"),
    promQuery(baseUrl, '100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)'),
    promQuery(baseUrl, "(1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100"),
    promQuery(
      baseUrl,
      'min(node_filesystem_avail_bytes{mountpoint="/",fstype!="tmpfs"} / node_filesystem_size_bytes{mountpoint="/",fstype!="tmpfs"}) * 100',
    ),
    promQuery(baseUrl, "redis_memory_used_bytes / redis_memory_max_bytes * 100"),
    promQuery(baseUrl, "sum(pg_stat_database_numbackends)"),
  ]);

  const flag = (samples: PrometheusSample[]) => (samples.length ? samples[0]!.value === 1 : null);
  return {
    targetsDown: up.filter((s) => s.value === 0).map((s) => s.metric.job ?? "unknown"),
    postgresUp: flag(pg),
    redisUp: flag(redis),
    cpuPercent: first(cpu),
    memoryPercent: first(mem),
    diskFreePercent: first(disk),
    redisMemoryPercent: first(redisMem),
    postgresConnections: first(conns),
  };
}

export interface DatabaseCheck {
  latencyMs: number;
}

/** The console's own view of Postgres — independent of the exporter, so it still works if monitoring is down. */
export async function collectDatabase(): Promise<DatabaseCheck> {
  const started = Date.now();
  await db.execute(sql`select 1`);
  return { latencyMs: Date.now() - started };
}
