export type ComponentStatus = "operational" | "degraded" | "down";

export interface StatusComponent {
  name: string;
  description: string;
  /**
   * What the poller requests. A dedicated health endpoint where the app has
   * one (Tenant Contract T-6), otherwise its public root. Omitted only for
   * this status app itself — if the page renders, it's up.
   */
  checkUrl?: string;
}

/**
 * Every component is checked through its real public URL (DNS, TLS, the
 * edge proxy, then the app), so an outage anywhere on that path shows up
 * here — see ./health.ts for how a response maps to a status.
 */
export const components: StatusComponent[] = [
  { name: "Website", description: "onenexora.com", checkUrl: "https://onenexora.com" },
  {
    name: "Account",
    description: "account.onenexora.com",
    checkUrl: "https://account.onenexora.com",
  },
  {
    name: "Console",
    description: "console.onenexora.com",
    checkUrl: "https://console.onenexora.com",
  },
  {
    name: "API",
    description: "api.onenexora.com",
    checkUrl: "https://api.onenexora.com/v1/health",
  },
  { name: "Docs", description: "docs.onenexora.com", checkUrl: "https://docs.onenexora.com" },
  {
    name: "Developers",
    description: "developers.onenexora.com",
    checkUrl: "https://developers.onenexora.com",
  },
  { name: "Status", description: "status.onenexora.com" },
  {
    name: "Sentinel",
    description: "sentinel.onenexora.com",
    checkUrl: "https://sentinel.onenexora.com/api/health",
  },
  {
    name: "CSPM",
    description: "cspm.onenexora.com",
    checkUrl: "https://cspm.onenexora.com/api/health",
  },
  {
    name: "Gateway",
    description: "gateway.onenexora.com",
    checkUrl: "https://gateway.onenexora.com/api/health",
  },
  {
    name: "Vigilo",
    description: "vigilo.onenexora.com",
    checkUrl: "https://vigilo.onenexora.com",
  },
  {
    name: "Vigilo API",
    description: "vigilo-api.onenexora.com",
    checkUrl: "https://vigilo-api.onenexora.com/healthz",
  },
];
