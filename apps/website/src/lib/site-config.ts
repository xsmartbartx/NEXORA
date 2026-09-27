/**
 * The hello@/legal@/security@ addresses are aliases of the
 * nexora@onenexora.com Workspace mailbox.
 *
 * NEXORA is run by a private individual, so legalEntityName is their name
 * and no postal address is published; contact is by email. Replace it
 * once a business is registered. A lawyer must
 * review the /legal pages before any of this is treated as binding — see
 * the notice banner rendered on each of them.
 */
export const siteConfig = {
  name: "NEXORA",
  contactEmail: "hello@onenexora.com",
  legalEmail: "legal@onenexora.com",
  securityEmail: "security@onenexora.com",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "https://onenexora.com",
  legalEntityName: "Bartłomiej Wroński",
  legalJurisdiction: "the Republic of Poland",
};
