/**
 * Every public surface the Control Center probes — the same set
 * `.github/workflows/uptime.yml` and apps/status check, written out here
 * because apps can't import each other. Keep the three in step.
 */
export type EndpointCategory = "platform" | "products" | "partners";

export interface Endpoint {
  name: string;
  url: string;
  category: EndpointCategory;
}

export const ENDPOINTS: Endpoint[] = [
  { name: "Website", url: "https://onenexora.com", category: "platform" },
  { name: "Account", url: "https://account.onenexora.com", category: "platform" },
  { name: "Console", url: "https://console.onenexora.com", category: "platform" },
  { name: "API", url: "https://api.onenexora.com/v1/health", category: "platform" },
  { name: "Docs", url: "https://docs.onenexora.com", category: "platform" },
  { name: "Developers", url: "https://developers.onenexora.com", category: "platform" },
  { name: "Status", url: "https://status.onenexora.com", category: "platform" },
  { name: "Sentinel", url: "https://sentinel.onenexora.com/api/health", category: "products" },
  { name: "CSPM", url: "https://cspm.onenexora.com/api/health", category: "products" },
  { name: "Gateway", url: "https://gateway.onenexora.com/api/health", category: "products" },
  { name: "Vigilo", url: "https://vigilo.onenexora.com", category: "partners" },
  { name: "Vigilo API", url: "https://vigilo-api.onenexora.com/healthz", category: "partners" },
  { name: "NeuraWall", url: "https://neurawall.onenexora.com/readyz", category: "partners" },
];

export const BACKUP_URL = "https://status.onenexora.com/api/backup";

/** Hostnames to check certificates for: every endpoint's host, plus the Grafana host. */
export function certificateHosts(): string[] {
  const hosts = new Set(ENDPOINTS.map((e) => new URL(e.url).hostname));
  hosts.add("monitoring.onenexora.com");
  return [...hosts].sort();
}
