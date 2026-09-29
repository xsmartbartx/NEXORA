import type { ChangelogEntry } from "../types";

/**
 * Seed records: real, dated platform changes — each one something that
 * actually shipped to production, not a roadmap item or a marketing line.
 * Newest first is not required here; `getChangelog` sorts by `date`.
 */
export const changelogEntries: ChangelogEntry[] = [
  {
    id: "chg_status_grouping",
    date: "2026-09-29",
    kind: "changed",
    title: "Status page groups components by Platform and Products",
    description:
      "status.onenexora.com now sections its live per-component checks instead of a single flat list.",
  },
  {
    id: "chg_security_txt",
    date: "2026-09-29",
    kind: "added",
    title: "Published security.txt and a repository SECURITY.md",
    description:
      "/.well-known/security.txt (RFC 9116) and a root SECURITY.md now point researchers at the existing vulnerability-reporting process.",
  },
  {
    id: "chg_stripe_live",
    date: "2026-09-26",
    kind: "changed",
    title: "Billing moved to live Stripe",
    description:
      "Production now runs on live Stripe keys with a dedicated webhook endpoint and a real Pro plan price, replacing the test-mode configuration.",
  },
  {
    id: "chg_google_oauth",
    date: "2026-09-26",
    product: "console",
    kind: "added",
    title: "Google sign-in enabled on production Clerk",
    description: "Account and Console support Google OAuth via a dedicated production client.",
  },
  {
    id: "chg_prod_deploy",
    date: "2026-09-25",
    kind: "added",
    title: "Full platform deployed to production",
    description:
      "All ten apps, the reverse proxy and Postgres are live on the current production instance with real Clerk credentials.",
  },
];
