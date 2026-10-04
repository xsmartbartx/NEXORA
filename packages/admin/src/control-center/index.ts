import { collectChecklist } from "./checklist";
import { collectCosts } from "./costs";
import { collectActivation, collectClerk, collectRevenue } from "./business";
import { collectVisitors } from "./analytics";
import { collectBackup, collectDatabase, collectInfraMetrics, probeAll } from "./health";
import { collectCi, collectSentry, summarizeLatency } from "./application";
import { collectAccessSignals, collectCertificates, collectCodeSecurity } from "./security";
import { collect } from "./result";

export * from "./result";
export * from "./endpoints";
export * from "./health";
export * from "./application";
export * from "./security";
export * from "./analytics";
export * from "./business";
export * from "./costs";
export * from "./checklist";
export * from "./logs";
export * from "./deployments";
export * from "./keys";
export * from "./webhooks";
export * from "./links";
export * from "./attention";
export { REPOS } from "./github";

/**
 * Gathers every tile. Collectors run in parallel and fail independently
 * (see `Tile`); the endpoint probe runs once and feeds both the health and
 * latency tiles.
 */
export async function collectControlCenter() {
  const endpoints = await collect(probeAll, 40_000);

  const [
    backup,
    database,
    infra,
    sentry,
    ci,
    codeSecurity,
    certificates,
    access,
    clerk,
    revenue,
    activation,
    costs,
    checklist,
    visitors,
  ] = await Promise.all([
    collect(collectBackup),
    collect(collectDatabase),
    collect(collectInfraMetrics),
    collect(collectSentry),
    collect(collectCi),
    collect(collectCodeSecurity),
    collect(collectCertificates, 20_000),
    collect(collectAccessSignals),
    collect(collectClerk),
    collect(collectRevenue),
    collect(collectActivation),
    collect(collectCosts),
    collect(collectChecklist),
    collect(collectVisitors),
  ]);

  const latency =
    endpoints.state === "ok"
      ? ({ state: "ok", data: summarizeLatency(endpoints.data) } as const)
      : endpoints;

  return {
    collectedAt: new Date(),
    health: { endpoints, backup, database, infra },
    application: { latency, sentry, ci },
    security: { codeSecurity, certificates, access },
    business: { visitors, clerk, activation, revenue },
    costs,
    checklist,
  };
}

export type ControlCenterSnapshot = Awaited<ReturnType<typeof collectControlCenter>>;
