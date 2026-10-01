import type { ProductCapability } from "../types";

/**
 * What each product's `beta` feature set actually does today — drawn
 * directly from the scoped claims already made in `products.ts`'s
 * descriptions, never expanded beyond them. Used by product detail pages
 * to list capabilities as discrete rows instead of parsing them back out
 * of prose.
 */
export const productCapabilities: ProductCapability[] = [
  {
    product: "sentinel",
    label: "Statistical outlier detection",
    description: "Flags log lines whose shape barely repeats in the sample you paste in.",
    order: 1,
  },
  {
    product: "sentinel",
    label: "Keyword rule matching",
    description: "Surfaces lines matching fatal/error/reliability keyword rules.",
    order: 2,
  },
  {
    product: "sentinel",
    label: "Stateless analysis",
    description:
      "Nothing is stored — each analysis runs on the sample you provide and nothing else.",
    order: 3,
  },

  {
    product: "cspm",
    label: "Public bucket detection",
    description: "Flags storage resources described as publicly readable.",
    order: 1,
  },
  {
    product: "cspm",
    label: "Open security group detection",
    description: "Flags wide-open ingress rules (e.g. 0.0.0.0/0) in a pasted resource description.",
    order: 2,
  },
  {
    product: "cspm",
    label: "Over-permissive IAM policy detection",
    description: "Flags wildcard actions/resources in a pasted IAM policy.",
    order: 3,
  },

  {
    product: "gateway",
    label: "Single governed endpoint",
    description: "One endpoint and one key in front of a configurable upstream AI provider.",
    order: 1,
  },
  {
    product: "gateway",
    label: "Entitlement-checked proxying",
    description:
      "Every call is authenticated, rate-limited and checked against the org's entitlements.",
    order: 2,
  },
  {
    product: "gateway",
    label: "Audit logging",
    description: "Every proxied call is recorded for the org's own audit trail.",
    order: 3,
  },

  {
    product: "vigilo",
    label: "Security header scanning",
    description:
      "Checks a live URL's public surface for missing or misconfigured security headers.",
    order: 1,
  },
  {
    product: "vigilo",
    label: "TLS configuration checks",
    description: "Flags weak or outdated TLS configuration on the scanned target.",
    order: 2,
  },
  {
    product: "vigilo",
    label: "Exposed secret detection",
    description: "Flags secrets inadvertently exposed on the target's public surface.",
    order: 3,
  },
  {
    product: "vigilo",
    label: "Scored remediation report",
    description: "Returns a scored report with concrete, copy-pasteable remediation steps.",
    order: 4,
  },

  {
    product: "neurawall",
    label: "Statistical flow anomaly scoring",
    description: "Scores network flows with a statistical anomaly engine.",
    order: 1,
  },
  {
    product: "neurawall",
    label: "L7 threat detectors",
    description:
      "Detects injection, DGA, DNS tunnelling, C2 beaconing, exfiltration and TLS fingerprint spoofing.",
    order: 2,
  },
  {
    product: "neurawall",
    label: "Human-approved enforcement",
    description:
      "Only human-approved rules enforce, via Ed25519-signed policy bundles nodes verify themselves.",
    order: 3,
  },
  {
    product: "neurawall",
    label: "Tamper-evident audit trail",
    description: "Canary rollout and a tamper-evident audit trail for every enforced rule.",
    order: 4,
  },
];
