import type { PlatformPillar } from "@nexora/registry";

/**
 * The static half of the navigation contract (§8.2). Platform pillars pull
 * their labels from the registry package (single source of truth for pillar
 * names); Products and Labs pull their entries from the registry itself at
 * render time. Nothing here duplicates registry data.
 */

export const platformPillarSlugs: PlatformPillar[] = ["ai", "security", "cloud"];

export interface Solution {
  slug: string;
  title: string;
  description: string;
  pillars: PlatformPillar[];
}

export const solutions: Solution[] = [
  {
    slug: "ai-development",
    title: "AI Development",
    description:
      "Ship AI features on a governed, observable model layer instead of a loose API key.",
    pillars: ["ai"],
  },
  {
    slug: "cloud-security",
    title: "Cloud Security",
    description: "Know your cloud posture continuously instead of at audit time.",
    pillars: ["security", "cloud"],
  },
  {
    slug: "ai-security",
    title: "AI Security",
    description:
      "Apply the same rigor to model access and AI output that you apply to production systems.",
    pillars: ["ai", "security"],
  },
  {
    slug: "automation",
    title: "Automation",
    description:
      "Let infrastructure and security work run itself, with a human in the loop where it matters.",
    pillars: ["cloud", "ai"],
  },
];

export function getSolution(slug: string): Solution | undefined {
  return solutions.find((s) => s.slug === slug);
}

export interface NavItem {
  label: string;
  href: string;
  /** Renders as a plain `<a>` — a different app/subdomain, not a route in this app. */
  external?: boolean;
}

const developersUrl = process.env.NEXT_PUBLIC_DEVELOPERS_URL ?? "https://developers.onenexora.com";

export const primaryNav: NavItem[] = [
  { label: "Platform", href: "/platform" },
  { label: "Products", href: "/products" },
  { label: "Solutions", href: "/solutions" },
  { label: "Developers", href: developersUrl, external: true },
  { label: "Labs", href: "/labs" },
  { label: "Company", href: "/company" },
];
