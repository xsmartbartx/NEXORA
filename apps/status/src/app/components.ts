export type ComponentStatus = "operational" | "degraded" | "down";

export interface StatusComponent {
  name: string;
  description: string;
  status: ComponentStatus;
}

/**
 * Manually maintained (§11, Phase 2 deliverable: "status app with manual
 * component definitions"). Automated health checks — Health consuming a
 * product's own published endpoint, per §4.1 — arrive once products exist
 * to report it, from Phase 4 onward. Update this list by hand until then.
 */
export const components: StatusComponent[] = [
  { name: "Website", description: "onenexora.com", status: "operational" },
  { name: "Account", description: "account.onenexora.com", status: "operational" },
  { name: "Console", description: "console.onenexora.com", status: "operational" },
  { name: "Status", description: "status.onenexora.com", status: "operational" },
];
