import type { ProductIntegration } from "../types";

/**
 * Product-to-product integration declarations (§5.2 ProductIntegration).
 * Empty today: no NEXORA product currently reads from or calls another —
 * see the type's own doc comment in types.ts. The query layer in
 * queries.ts and its UI surface on the product detail page are built and
 * render an honest "no declared integrations yet" state; the first real
 * one is added here, nowhere else.
 */
export const productIntegrations: ProductIntegration[] = [];
