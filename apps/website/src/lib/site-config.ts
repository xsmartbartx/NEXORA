/**
 * TODO(launch): `onenexora.com` is not registered/DNS-configured yet (§7.1
 * of the architecture doc is a reservation plan, not a live domain), and
 * the contact inbox below is not a verified, monitored address. Replace
 * both — and set NEXT_PUBLIC_SITE_URL in the deploy environment — with the
 * real domain and a real inbox before this site goes live. Do not let a
 * visitor-facing contact point stay a placeholder in production.
 *
 * TODO(launch): the legal fields below are placeholders, not business or
 * legal decisions — no registered entity exists yet for this project, so
 * there is nothing real to put here. They exist so the /legal pages have
 * somewhere to pull from once real values exist, same pattern as pricing
 * in packages/billing/src/plans.ts. A lawyer must review the /legal pages
 * themselves before any of this is treated as binding — see the notice
 * banner rendered on each of them.
 */
export const siteConfig = {
  name: "NEXORA",
  contactEmail: "hello@onenexora.com",
  legalEmail: "legal@onenexora.com",
  securityEmail: "security@onenexora.com",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "https://onenexora.com",
  legalEntityName: "[LEGAL ENTITY NAME — NOT YET INCORPORATED]",
  legalJurisdiction: "[GOVERNING LAW JURISDICTION — TBD]",
  legalAddress: "[REGISTERED BUSINESS ADDRESS — TBD]",
};
