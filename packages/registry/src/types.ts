/**
 * Entity model per NEXORA-PLATFORM-ARCHITECTURE.md §5.2.
 * This is the single source of truth for what products exist on the
 * platform (P-6). Every public surface (home, listing, nav, search,
 * product page, sitemap) reads through the query layer in `queries.ts`,
 * never this data directly.
 */

export type ProductCategory = "ai" | "security" | "cloud" | "developer";

export type PlatformPillar = "ai" | "security" | "cloud";

export type ProductLifecycle =
  "concept" | "alpha" | "beta" | "production" | "maintenance" | "retired";

export type ProductVisibility = "public" | "private" | "internal";

export interface Product {
  id: string;
  slug: string;
  name: string;
  short_name: string;
  tagline: string;
  /** Markdown. Used on product and listing pages. */
  description: string;
  category: ProductCategory;
  platform_pillar: PlatformPillar;
  lifecycle: ProductLifecycle;
  visibility: ProductVisibility;
  featured: boolean;
  url: string;
  app_url?: string;
  docs_url?: string;
  pricing_url?: string;
  repository_url?: string;
  /** Asset key in the design system. */
  icon: string;
  version?: string;
  health_source?: string;
  owner: string;
  launched_at?: string;
}

export interface ProductCapability {
  product: string;
  label: string;
  description: string;
  order: number;
}

export interface ProductPlan {
  product: string;
  name: string;
  limits: string;
  price_reference: string;
}

export interface ProductIntegration {
  product: string;
  target_product: string;
  direction: "inbound" | "outbound" | "bidirectional";
}

export interface ProductDocSection {
  product: string;
  path: string;
  title: string;
  order: number;
}
