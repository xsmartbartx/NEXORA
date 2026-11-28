import { getAllProducts } from "@nexora/registry";

export type ComponentStatus = "operational" | "degraded" | "down";

/** Groups components on the status page — Tier 1 core vs. Tier 2 products vs. shared infra. */
export type ComponentCategory = "platform" | "products" | "infrastructure";

export interface StatusComponent {
  name: string;
  description: string;
  category: ComponentCategory;
  /**
   * What the poller requests. A dedicated health endpoint where the app has
   * one (Tenant Contract T-6), otherwise its public root. Omitted only for
   * this status app itself — if the page renders, it's up.
   */
  checkUrl?: string;
}

/**
 * Every component is checked through its real public URL (DNS, TLS, the
 * edge proxy, then the app), so an outage anywhere on that path shows up
 * here — see ./health.ts for how a response maps to a status.
 */
const platformComponents: StatusComponent[] = [
  {
    name: "Website",
    description: "onenexora.com",
    category: "platform",
    checkUrl: "https://onenexora.com",
  },
  {
    name: "Account",
    description: "account.onenexora.com",
    category: "platform",
    checkUrl: "https://account.onenexora.com",
  },
  {
    name: "Console",
    description: "console.onenexora.com",
    category: "platform",
    checkUrl: "https://console.onenexora.com",
  },
  {
    name: "API",
    description: "api.onenexora.com",
    category: "platform",
    checkUrl: "https://api.onenexora.com/v1/health",
  },
  {
    name: "Docs",
    description: "docs.onenexora.com",
    category: "platform",
    checkUrl: "https://docs.onenexora.com",
  },
  {
    name: "Developers",
    description: "developers.onenexora.com",
    category: "platform",
    checkUrl: "https://developers.onenexora.com",
  },
  { name: "Status", description: "status.onenexora.com", category: "platform" },
];

/**
 * Products whose site is a separate app from their health source, so both
 * are probed, as two components: "<name>" is the site and "<name> API" the
 * health source. Vigilo's health source is its API (vigilo-api.onenexora.com),
 * and its Next.js site can fail on its own.
 */
const alsoProbeSite = new Set(["vigilo"]);

/**
 * Products come from the registry (§5.4, §8.8): every product that declares
 * a `health_source` and is still running (not `retired`), in registry order,
 * probed at that health source. A product with no health source is not
 * listed until it declares one.
 */
function productComponents(): StatusComponent[] {
  return getAllProducts().flatMap((product): StatusComponent[] => {
    const healthSource = product.health_source;
    if (!healthSource || product.lifecycle === "retired") return [];
    const siteHost = new URL(product.url).host;
    if (!alsoProbeSite.has(product.slug)) {
      return [
        {
          name: product.short_name,
          description: siteHost,
          category: "products",
          checkUrl: healthSource,
        },
      ];
    }
    return [
      {
        name: product.short_name,
        description: siteHost,
        category: "products",
        checkUrl: product.url,
      },
      {
        name: `${product.short_name} API`,
        description: new URL(healthSource).host,
        category: "products",
        checkUrl: healthSource,
      },
    ];
  });
}

export const components: StatusComponent[] = [...platformComponents, ...productComponents()];

export const categoryLabel: Record<ComponentCategory, string> = {
  platform: "Platform",
  products: "Products",
  infrastructure: "Infrastructure",
};
