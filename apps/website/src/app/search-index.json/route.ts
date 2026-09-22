import { getPublicProducts, pillarLabels, pillarTaglines, productHref } from "@nexora/registry";
import { platformPillarSlugs, solutions } from "@/lib/nav";

/**
 * The search surface of §5.4: one JSON index built from the same registry
 * data every other surface reads, so a site-search UI (added when it earns
 * its place) never drifts from what actually exists on the platform.
 */
interface SearchEntry {
  title: string;
  description: string;
  url: string;
  type: "product" | "pillar" | "solution";
}

export async function GET() {
  const products: SearchEntry[] = getPublicProducts().map((product) => ({
    title: product.name,
    description: product.tagline,
    url: productHref(product),
    type: "product",
  }));

  const pillars: SearchEntry[] = platformPillarSlugs.map((pillar) => ({
    title: pillarLabels[pillar],
    description: pillarTaglines[pillar],
    url: `/platform/${pillar}`,
    type: "pillar",
  }));

  const solutionEntries: SearchEntry[] = solutions.map((solution) => ({
    title: solution.title,
    description: solution.description,
    url: `/solutions/${solution.slug}`,
    type: "solution",
  }));

  return Response.json([...products, ...pillars, ...solutionEntries]);
}
