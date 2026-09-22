/**
 * TODO(launch): `onenexora.com` is not registered/DNS-configured yet (§7.1
 * of the architecture doc is a reservation plan, not a live domain), and
 * the contact inbox below is not a verified, monitored address. Replace
 * both — and set NEXT_PUBLIC_SITE_URL in the deploy environment — with the
 * real domain and a real inbox before this site goes live. Do not let a
 * visitor-facing contact point stay a placeholder in production.
 */
export const siteConfig = {
  name: "NEXORA",
  contactEmail: "hello@onenexora.com",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "https://onenexora.com",
};
