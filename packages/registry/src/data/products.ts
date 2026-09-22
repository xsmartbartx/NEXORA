import type { Product } from "../types";

/**
 * Seed records for the products named in the architecture document (§14.3,
 * day 29–30: "Seed registry with Sentinel, CSPM and Gateway at correct
 * lifecycle states").
 *
 * Sentinel and CSPM were promoted to `beta`/`public` in Phase 4, once their
 * product apps existed and passed the Tenant Contract (§4.3) — see
 * apps/sentinel and apps/cspm. Their descriptions are deliberately scoped
 * to what those apps actually do today (statistical/rule-based analysis on
 * data you paste in), not the eventual live-cloud-connected vision —
 * promoting the lifecycle state is not licence to overclaim the copy.
 *
 * Gateway has no app yet, so it stays `concept`/`internal` per §5.3: that
 * means it surfaces only in Labs and internal console views, never as a
 * public claim of a shipping product. Promote its `lifecycle`/`visibility`
 * here — nothing else — once its product app exists and passes the Tenant
 * Contract.
 */
export const products: Product[] = [
  {
    id: "prod_sentinel",
    slug: "sentinel",
    name: "AI Cloud Log Sentinel",
    short_name: "Sentinel",
    tagline: "Paste a log sample, find the ten lines worth reading.",
    description:
      "Sentinel flags the log lines that don't fit the pattern — rare shapes, one-off codes, the anomalies worth a human's attention in ten thousand lines of noise. Today that's real statistical outlier detection plus keyword rules, running on a sample you paste in; deeper AI-based analysis and live cloud log connections are on the roadmap.",
    category: "security",
    platform_pillar: "security",
    lifecycle: "beta",
    visibility: "public",
    featured: true,
    url: "https://sentinel.onenexora.com",
    app_url: "https://sentinel.onenexora.com/app",
    health_source: "https://sentinel.onenexora.com/api/health",
    icon: "sentinel",
    owner: "Platform Team",
  },
  {
    id: "prod_cspm",
    slug: "cspm",
    name: "NEXORA CSPM",
    short_name: "CSPM",
    tagline: "Paste your cloud config, get real findings back.",
    description:
      "CSPM checks a description of your cloud resources — buckets, security groups, IAM policies — against the same class of rule set a live-connected scanner runs: public buckets, wide-open ingress, over-permissive policies. Today it works on resource data you paste in; connecting a live cloud account is on the roadmap.",
    category: "security",
    platform_pillar: "cloud",
    lifecycle: "beta",
    visibility: "public",
    featured: true,
    url: "https://cspm.onenexora.com",
    app_url: "https://cspm.onenexora.com/app",
    health_source: "https://cspm.onenexora.com/api/health",
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
