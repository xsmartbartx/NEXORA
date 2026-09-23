export type ComponentStatus = "operational" | "degraded" | "down";

export interface StatusComponent {
  name: string;
  description: string;
  status: ComponentStatus;
  /** Where a future automated poller would check (§4.1's Health service) — not polled yet. */
  healthUrl?: string;
}

/**
 * Manually maintained (§11, Phase 2 deliverable: "status app with manual
 * component definitions"). Sentinel and CSPM (Phase 4) publish a real
 * `/api/health` endpoint each (Tenant Contract T-6) — `healthUrl` records
 * where, so wiring an automated poller later is a data change here, not a
 * rewrite. Nothing polls them yet; update `status` by hand until the
 * Health service (§4.1) exists to do it.
 */
export const components: StatusComponent[] = [
  { name: "Website", description: "onenexora.com", status: "operational" },
  { name: "Account", description: "account.onenexora.com", status: "operational" },
  { name: "Console", description: "console.onenexora.com", status: "operational" },
  {
    name: "API",
    description: "api.onenexora.com",
    status: "operational",
    healthUrl: "https://api.onenexora.com/v1/health",
  },
  { name: "Docs", description: "docs.onenexora.com", status: "operational" },
  { name: "Developers", description: "developers.onenexora.com", status: "operational" },
  { name: "Status", description: "status.onenexora.com", status: "operational" },
  {
    name: "Sentinel",
    description: "sentinel.onenexora.com",
    status: "operational",
    healthUrl: "https://sentinel.onenexora.com/api/health",
  },
  {
    name: "CSPM",
    description: "cspm.onenexora.com",
    status: "operational",
    healthUrl: "https://cspm.onenexora.com/api/health",
  },
];
