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

/**
 * Declares a functional connection between two Products (§5.2) — one
 * product's own data or requests flowing into another. Not shared Core
 * infrastructure (identity, entitlements, billing, telemetry): every
 * product already consumes those, and listing that here would just repeat
 * §4 rather than declare something new. Unseeded today (Phase 6): no
 * product currently reads from or calls another — each is deliberately
 * isolated per the Tenant Contract's "neither holds a user table" /
 * isolation principle. The type and query layer exist so declaring the
 * first real one is a data change, not a schema rewrite.
 */
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

/**
 * Marketplace taxonomy (§14.3 Phase 6): listing kinds beyond "product".
 * "app" is deliberately excluded — an app is a Product (§5.2), already
 * modelled, already has a subdomain and a Tenant Contract; duplicating it
 * as a MarketplaceListing would be the exact documentation drift R-7 warns
 * against. These five kinds cover everything a Product record can't.
 */
export type MarketplaceListingKind = "api" | "agent" | "model" | "integration" | "tool";

/** `partner` is unused today — no third-party listing model exists yet (no partner has been pursued). Kept so adding one is a data change, not a schema rewrite (Phase 6 exit criterion). */
export type MarketplaceListingProvider = "nexora" | "partner";

/** `planned` marks a taxonomy slot with no real listing yet — rendered as an honest empty state, never a fabricated entry. */
export type MarketplaceListingStatus = "available" | "planned";

export interface MarketplaceListing {
  id: string;
  slug: string;
  kind: MarketplaceListingKind;
  name: string;
  tagline: string;
  description: string;
  provider: MarketplaceListingProvider;
  status: MarketplaceListingStatus;
  /** Where the listing actually lives — a docs page, a product's app, an external repo. */
  link: string;
  /** Slug of the Product this listing extends, if any (e.g. an "integration" listing that's really a capability of Gateway). */
  relatedProduct?: string;
  publishedAt: string;
}

export type ExperimentKind = "research" | "open-source";

/**
 * Labs (§8.7): "research write-ups and open source components" — content
 * that belongs in Labs but isn't a Product (no lifecycle to graduate
 * through, no subdomain, no Tenant Contract). Published by adding a record
 * here, same as a Product — never by touching the products catalogue or
 * any page's code (Phase 5 exit criteria).
 */
export interface Experiment {
  id: string;
  slug: string;
  title: string;
  summary: string;
  kind: ExperimentKind;
  /** External link (a GitHub repo, an npm package) or an internal docs path. */
  link: string;
  publishedAt: string;
}
