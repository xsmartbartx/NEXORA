import { productCapabilities } from "./data/capabilities";
import { changelogEntries } from "./data/changelog";
import { productDocSections } from "./data/doc-sections";
import { experiments } from "./data/experiments";
import { productIntegrations } from "./data/integrations";
import { marketplaceListings } from "./data/marketplace-listings";
import { productPlans } from "./data/product-plans";
import { products } from "./data/products";
import type {
  ChangelogEntry,
  Experiment,
  MarketplaceListing,
  MarketplaceListingKind,
  PlatformPillar,
  Product,
  ProductCapability,
  ProductCategory,
  ProductDocSection,
  ProductIntegration,
  ProductPlan,
} from "./types";

/**
 * The query layer every surface reads through (§5.4). Nothing outside this
 * file touches `data/products.ts` directly — that keeps today's file-backed
 * source swappable for a real database later (Phase 2) without changing a
 * single caller. This mirrors how a repository backed by Postgres would be
 * shaped: narrow, purpose-built reads, not a raw table dump.
 */

function isPublic(product: Product): boolean {
  return product.visibility === "public";
}

/** Every registry record, regardless of visibility. Internal/console use only. */
export function getAllProducts(): Product[] {
  return products;
}

/** Public-surface product list: homepage, /products, nav, search, sitemap. */
export function getPublicProducts(): Product[] {
  return products.filter(isPublic);
}

export function getFeaturedProducts(): Product[] {
  return products.filter((p) => isPublic(p) && p.featured);
}

export function getProductBySlug(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug);
}

export function getProductsByPillar(pillar: PlatformPillar): Product[] {
  return products.filter((p) => isPublic(p) && p.platform_pillar === pillar);
}

export function getProductsByCategory(category: ProductCategory): Product[] {
  return products.filter((p) => isPublic(p) && p.category === category);
}

/** Labs surfaces concept/alpha records regardless of visibility (§8.7, §5.3). */
export function getLabsProducts(): Product[] {
  return products.filter((p) => p.lifecycle === "concept" || p.lifecycle === "alpha");
}

/** Every published Labs experiment (§8.7) — write-ups and open-source components that aren't a Product. */
export function getExperiments(): Experiment[] {
  return experiments;
}

export function getExperimentBySlug(slug: string): Experiment | undefined {
  return experiments.find((e) => e.slug === slug);
}

/** Every marketplace listing (§14.3 Phase 6), regardless of kind or status. */
export function getMarketplaceListings(): MarketplaceListing[] {
  return marketplaceListings;
}

export function getMarketplaceListingsByKind(kind: MarketplaceListingKind): MarketplaceListing[] {
  return marketplaceListings.filter((listing) => listing.kind === kind);
}

export function getMarketplaceListingBySlug(slug: string): MarketplaceListing | undefined {
  return marketplaceListings.find((listing) => listing.slug === slug);
}

/** Declared integrations for one product, in either direction (as source or target). */
export function getProductIntegrations(productSlug: string): ProductIntegration[] {
  return productIntegrations.filter(
    (integration) =>
      integration.product === productSlug || integration.target_product === productSlug,
  );
}

export function getAllProductIntegrations(): ProductIntegration[] {
  return productIntegrations;
}

/** Every changelog entry, newest first. */
export function getChangelog(): ChangelogEntry[] {
  return [...changelogEntries].sort((a, b) => (a.date < b.date ? 1 : -1));
}

/** A single product's changelog entries, newest first. */
export function getChangelogForProduct(productSlug: string): ChangelogEntry[] {
  return getChangelog().filter((entry) => entry.product === productSlug);
}

/** A product's capabilities, in display order. */
export function getProductCapabilities(productSlug: string): ProductCapability[] {
  return productCapabilities
    .filter((capability) => capability.product === productSlug)
    .sort((a, b) => a.order - b.order);
}

/** A product's plan reference rows (display-only — see `data/product-plans.ts`). */
export function getProductPlans(productSlug: string): ProductPlan[] {
  return productPlans.filter((plan) => plan.product === productSlug);
}

/** A product's doc sections, in display order. */
export function getProductDocSections(productSlug: string): ProductDocSection[] {
  return productDocSections
    .filter((section) => section.product === productSlug)
    .sort((a, b) => a.order - b.order);
}

/**
 * Internal route for a product's detail page. Distinct from `product.url`
 * (the product's eventual subdomain root, per R-1/R-2) which is not live
 * until the subdomain is provisioned and the product passes the Tenant
 * Contract (§4.3) — until then every internal link uses this route instead.
 */
export function productHref(product: Product): string {
  return `/products/${product.slug}`;
}
