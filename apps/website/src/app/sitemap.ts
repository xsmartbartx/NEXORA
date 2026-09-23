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
    "/company",
  ];

  const pillarRoutes = platformPillarSlugs.map((pillar) => `/platform/${pillar}`);
  const solutionRoutes = solutions.map((solution) => `/solutions/${solution.slug}`);
  const productRoutes = getPublicProducts().map((product) => productHref(product));
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
