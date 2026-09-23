import { NextResponse } from "next/server";
import { getPublicProducts } from "@nexora/registry";
import { withApiKey } from "@nexora/api-kit";

/**
 * C-META over the wire: the same Product Registry every other surface
 * reads from (§5.4), authenticated (§6.4) rather than public — this is the
 * quickstart's "first successful call" (Phase 3 exit criteria).
 */
export async function GET(request: Request) {
  return withApiKey(request, "api", async () => {
    const products = getPublicProducts().map((product) => ({
      id: product.id,
      slug: product.slug,
      name: product.name,
      tagline: product.tagline,
      category: product.category,
      platform_pillar: product.platform_pillar,
      lifecycle: product.lifecycle,
      url: product.url,
    }));
    return NextResponse.json({ data: products });
  });
}
