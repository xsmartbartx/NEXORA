import { experiments } from "./data/experiments";
import { products } from "./data/products";
import type { Experiment, PlatformPillar, Product, ProductCategory } from "./types";

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

/**
 * Internal route for a product's detail page. Distinct from `product.url`
 * (the product's eventual subdomain root, per R-1/R-2) which is not live
 * until the subdomain is provisioned and the product passes the Tenant
 * Contract (§4.3) — until then every internal link uses this route instead.
 */
export function productHref(product: Product): string {
  return `/products/${product.slug}`;
}
