import { NextResponse } from "next/server";
import { getProductBySlug } from "@nexora/registry";
import { apiError } from "@/lib/api-error";
import { withApiKey } from "@/lib/with-api-key";

export async function GET(request: Request, props: { params: Promise<{ slug: string }> }) {
  return withApiKey(request, async () => {
    const { slug } = await props.params;
    const product = getProductBySlug(slug);

    if (!product || product.visibility !== "public") {
      return apiError(404, "product_not_found", `No public product with slug "${slug}".`);
    }

    return NextResponse.json({
      data: {
        id: product.id,
        slug: product.slug,
        name: product.name,
        tagline: product.tagline,
        description: product.description,
        category: product.category,
        platform_pillar: product.platform_pillar,
        lifecycle: product.lifecycle,
        url: product.url,
      },
    });
  });
}
