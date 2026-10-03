export interface ToolLink {
  label: string;
  href: string;
  note?: string;
}

export interface ToolGroup {
  name: string;
  links: ToolLink[];
}

/** The owner's toolbox, grouped the way the work is done. Every link is a real console for something this platform runs on. */
export const TOOLBOX: ToolGroup[] = [
  {
    name: "Identity & accounts",
    links: [
      { label: "Google Workspace", href: "https://admin.google.com" },
      { label: "Clerk", href: "https://dashboard.clerk.com" },
      { label: "Stripe", href: "https://dashboard.stripe.com" },
      { label: "Squarespace (DNS)", href: "https://account.squarespace.com/domains" },
    ],
  },
  {
    name: "Development",
    links: [
      { label: "GitHub", href: "https://github.com/xsmartbartx/NEXORA" },
      { label: "GitHub Actions", href: "https://github.com/xsmartbartx/NEXORA/actions" },
      { label: "Pull requests", href: "https://github.com/xsmartbartx/NEXORA/pulls" },
    ],
  },
  {
    name: "Cloud",
    links: [
      { label: "Oracle Cloud console", href: "https://cloud.oracle.com" },
      {
        label: "Cost analysis",
        href: "https://cloud.oracle.com/account-management/cost-analysis",
      },
    ],
  },
  {
    name: "Security",
    links: [
      { label: "GitHub security", href: "https://github.com/xsmartbartx/NEXORA/security" },
      { label: "Dependabot", href: "https://github.com/xsmartbartx/NEXORA/security/dependabot" },
      {
        label: "Code scanning",
        href: "https://github.com/xsmartbartx/NEXORA/security/code-scanning",
      },
    ],
  },
  {
    name: "Observability",
    links: [
      { label: "Grafana", href: "https://monitoring.onenexora.com" },
      { label: "Sentry", href: "https://sentry.io" },
      { label: "Status page", href: "https://status.onenexora.com" },
    ],
  },
  {
    name: "Analytics & SEO",
    links: [
      { label: "Google Analytics", href: "https://analytics.google.com" },
      {
        label: "Search Console",
        href: "https://search.google.com/search-console?resource_id=sc-domain%3Aonenexora.com",
      },
      {
        label: "PageSpeed Insights",
        href: "https://pagespeed.web.dev/analysis?url=https%3A%2F%2Fonenexora.com",
      },
    ],
  },
];
