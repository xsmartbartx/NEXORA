import type { Product } from "../types";

/**
 * Seed records for the products named in the architecture document (§14.3,
 * day 29–30: "Seed registry with Sentinel, CSPM and Gateway at correct
 * lifecycle states"). None of the three has shipped code yet, so all three
 * are `concept` / `internal`: per §5.3 that means they surface only in Labs
 * and internal console views, never as a public claim of a shipping
 * product. Promote a record's `lifecycle`/`visibility` here — nothing else
 * — once its product repository exists and passes the Tenant Contract
 * (§4.3).
 */
export const products: Product[] = [
  {
    id: "prod_sentinel",
    slug: "sentinel",
    name: "AI Cloud Log Sentinel",
    short_name: "Sentinel",
    tagline: "AI-assisted log monitoring for cloud environments.",
    description:
      "Sentinel watches cloud telemetry and surfaces the anomalies worth a human's attention, using AI to cut through log volume that no team can read by hand.",
    category: "security",
    platform_pillar: "security",
    lifecycle: "concept",
    visibility: "internal",
    featured: false,
    url: "https://sentinel.onenexora.com",
    icon: "sentinel",
    owner: "Platform Team",
  },
  {
    id: "prod_cspm",
    slug: "cspm",
    name: "NEXORA CSPM",
    short_name: "CSPM",
    tagline: "Continuous cloud security posture management.",
    description:
      "CSPM continuously evaluates cloud infrastructure against security and compliance baselines, and reports drift before it becomes an incident.",
    category: "security",
    platform_pillar: "cloud",
    lifecycle: "concept",
    visibility: "internal",
    featured: false,
    url: "https://cspm.onenexora.com",
    icon: "cspm",
    owner: "Platform Team",
  },
  {
    id: "prod_gateway",
    slug: "gateway",
    name: "Secure AI Gateway",
    short_name: "Gateway",
    tagline: "A governed front door for every model call your org makes.",
    description:
      "Gateway sits between applications and AI model providers, applying authentication, rate limits, policy and audit logging to every request, regardless of provider.",
    category: "ai",
    platform_pillar: "ai",
    lifecycle: "concept",
    visibility: "internal",
    featured: false,
    url: "https://gateway.onenexora.com",
    icon: "gateway",
    owner: "Platform Team",
  },
];
