import { PLANS } from "@nexora/billing";
import { getAllProducts, type Product } from "@nexora/registry";

export interface ControllableProduct {
  slug: string;
  name: string;
  /** Metered feature keys this product exposes, e.g. `["sentinel.scan"]" — what Entitlements/telemetry track usage against. */
  features: string[];
  registryEntry: Product | undefined;
}

/**
 * The products an admin can actually suspend access to: derived from the
 * plan catalog's own limit keys, never a hand-maintained list. A product
 * only shows up here once it's wired into billing (§4.1) — same rule
 * `plans.ts` already follows for what counts as "real". Vigilo, for
 * example, is in the public registry but not yet in any plan's limits, so
 * it won't appear until it is — a data change there, not a change here.
 */
export function getControllableProducts(): ControllableProduct[] {
  const bySlug = new Map<string, Set<string>>();
  for (const plan of PLANS) {
    for (const feature of Object.keys(plan.limits)) {
      const slug = feature.split(".")[0] ?? feature;
      if (!bySlug.has(slug)) bySlug.set(slug, new Set());
      bySlug.get(slug)!.add(feature);
    }
  }

  const registry = getAllProducts();
  return Array.from(bySlug.entries())
    .map(([slug, features]) => {
      const registryEntry = registry.find((p) => p.slug === slug);
      return {
        slug,
        name: registryEntry?.short_name ?? slug,
        features: Array.from(features).sort(),
        registryEntry,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
