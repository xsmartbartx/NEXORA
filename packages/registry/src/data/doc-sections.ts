import type { ProductDocSection } from "../types";

/**
 * Per-product anchors inside the shared `docs.onenexora.com/products` page
 * (`apps/docs/src/app/products/page.tsx`) — there's no per-product docs
 * route yet, so `path` points at that page's section anchors rather than a
 * standalone URL. Lets product detail pages link straight to a product's
 * own quickstart instead of the generic docs index.
 */
export const productDocSections: ProductDocSection[] = [
  { product: "sentinel", path: "/products#sentinel", title: "Quickstart", order: 1 },
  { product: "cspm", path: "/products#cspm", title: "Quickstart", order: 1 },
  { product: "gateway", path: "/products#gateway", title: "Quickstart", order: 1 },
];
