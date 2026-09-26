import type { Product } from "../types";

/**
 * Seed records for the products named in the architecture document (§14.3,
 * day 29–30: "Seed registry with Sentinel, CSPM and Gateway at correct
 * lifecycle states").
 *
 * Sentinel and CSPM were promoted to `beta`/`public` in Phase 4; Gateway in
 * Phase 5 — each once its product app existed and passed the Tenant
 * Contract (§4.3). Every description is deliberately scoped to what that
 * app actually does today (real but narrow), not the eventual full
 * vision — promoting the lifecycle state is not licence to overclaim the
 * copy.
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
      "Gateway sits between applications and AI model providers, so your org calls one endpoint with one key instead of a loose API key copy-pasted into every service. Today that's one configurable upstream provider, proxied with full auth, rate-limiting, entitlement checks and audit logging; multi-provider routing and a model policy engine are on the roadmap.",
    category: "ai",
    platform_pillar: "ai",
    lifecycle: "beta",
    visibility: "public",
    featured: true,
    url: "https://gateway.onenexora.com",
    app_url: "https://gateway.onenexora.com/app",
    health_source: "https://gateway.onenexora.com/api/health",
    icon: "gateway",
    owner: "Platform Team",
  },
  {
    id: "prod_vigilo",
    slug: "vigilo",
    name: "Vigilo",
    short_name: "Vigilo",
    tagline: "Scan any live URL, get a real security and compliance report back.",
    description:
      "Vigilo scans a live web app's public surface — security headers, TLS configuration, exposed secrets, GDPR/legal-link presence — and returns a scored report with concrete, copy-pasteable remediation steps. Today that's passive, non-intrusive checks anyone can run against a public URL for free; deeper active-tier probing (endpoint enumeration, further compliance checks) unlocks once you verify ownership of the target. Independently built and hosted — not yet on Core identity/entitlements, so it's `beta` here rather than a deeper platform integration.",
    category: "security",
    platform_pillar: "security",
    lifecycle: "beta",
    visibility: "public",
    featured: true,
    url: "https://vigilo.onenexora.com",
    health_source: "https://vigilo-api.onenexora.com/healthz",
    icon: "vigilo",
    owner: "Platform Team",
  },
];
