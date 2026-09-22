export type {
  Product,
  ProductCapability,
  ProductCategory,
  ProductDocSection,
  ProductIntegration,
  ProductLifecycle,
  ProductPlan,
  ProductVisibility,
  PlatformPillar,
} from "./types";

export {
  getAllProducts,
  getFeaturedProducts,
  getLabsProducts,
  getProductBySlug,
  getProductsByCategory,
  getProductsByPillar,
  getPublicProducts,
  productHref,
} from "./queries";

export { categoryLabels, lifecycleLabels, pillarLabels, pillarTaglines } from "./labels";
