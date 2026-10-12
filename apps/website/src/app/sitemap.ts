import type { MetadataRoute } from "next";
import { getExperiments, getPublicProducts, productHref } from "@nexora/registry";
import { platformPillarSlugs, solutions } from "@/lib/nav";
import { siteConfig } from "@/lib/site-config";

/**
 * Generated, not hand-maintained: static routes plus every registry-driven
 * route (products, platform pillars, Labs experiments). Adding a public
 * registry record updates this automatically — no code change (§5.4, SC-1).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = [
    "",
    "/platform",
    "/products",
    "/marketplace",
    "/solutions",
    "/labs",
    "/changelog",
    "/pricing",
    "/bundles",
    "/company",
    "/legal",
    "/legal/terms",
    "/legal/privacy",
    "/legal/security",
    "/security/architecture",
  ];

  const pillarRoutes = platformPillarSlugs.map((pillar) => `/platform/${pillar}`);
  const solutionRoutes = solutions.map((solution) => `/solutions/${solution.slug}`);
  // Vigilo's and NeuraWall's pages redirect to their own sites (next.config.ts), so they are
  // not listed here.
  const productRoutes = getPublicProducts()
    .filter((product) => product.slug !== "vigilo" && product.slug !== "neurawall")
    .map((product) => productHref(product));
  const experimentRoutes = getExperiments().map((experiment) => experiment.link);

  const routes = [
    ...staticRoutes,
    ...pillarRoutes,
    ...solutionRoutes,
    ...productRoutes,
    ...experimentRoutes,
  ];

  return routes.map((route) => ({
    url: `${siteConfig.siteUrl}${route}`,
    lastModified: new Date(),
  }));
}
