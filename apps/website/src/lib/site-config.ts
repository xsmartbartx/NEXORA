/**
 * TODO(launch): confirm the hello@/legal@/security@ inboxes below are real,
 * monitored addresses — the legal pages and security policy promise
 * replies from them.
 *
 * TODO(launch): legalEntityName and legalAddress are placeholders — no
 * registered entity exists yet. Fill them in once one does. A lawyer must
 * review the /legal pages before any of this is treated as binding — see
 * the notice banner rendered on each of them.
 */
export const siteConfig = {
  name: "NEXORA",
  contactEmail: "hello@onenexora.com",
  legalEmail: "legal@onenexora.com",
  securityEmail: "security@onenexora.com",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "https://onenexora.com",
  legalEntityName: "[LEGAL ENTITY NAME — NOT YET INCORPORATED]",
  legalJurisdiction: "the Republic of Poland",
  legalAddress: "[REGISTERED BUSINESS ADDRESS — TBD]",
};
