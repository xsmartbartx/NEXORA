import type { Metadata } from "next";
import Link from "next/link";
import { cn } from "@nexora/ui";
import { categoryLabels, getPublicProducts, type ProductCategory } from "@nexora/registry";
import { ProductCard } from "@/components/product-card";

export const metadata: Metadata = {
  title: "Products",
  description: "Every NEXORA product, in one registry-driven catalogue.",
};

const categories = Object.keys(categoryLabels) as ProductCategory[];

function isCategory(value: string): value is ProductCategory {
  return categories.includes(value as ProductCategory);
}

export default async function ProductsPage(props: PageProps<"/products">) {
  const searchParams = await props.searchParams;
  const rawCategory = searchParams.category;
  const activeCategory =
    typeof rawCategory === "string" && isCategory(rawCategory) ? rawCategory : null;

  const products = getPublicProducts().filter(
    (p) => !activeCategory || p.category === activeCategory,
  );

  return (
    <div className="mx-auto max-w-6xl px-6 py-20">
      <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        Catalogue
      </span>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">Products</h1>
      <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
        Every product listed here shares NEXORA&rsquo;s identity, billing and API surface. This page
        is rendered directly from the Product Registry.
      </p>

      <div className="mt-8 flex flex-wrap gap-2">
        <Link
          href="/products"
          className={cn(
            "rounded-full border px-3 py-1 text-sm transition-colors",
            !activeCategory
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          All
        </Link>
        {categories.map((category) => (
          <Link
            key={category}
            href={`/products?category=${category}`}
            className={cn(
              "rounded-full border px-3 py-1 text-sm transition-colors",
              activeCategory === category
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {categoryLabels[category]}
          </Link>
        ))}
      </div>

      {products.length > 0 ? (
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="mt-16 rounded-xl border border-dashed border-border p-10 text-center">
          <p className="text-muted-foreground">
            No public product{activeCategory ? ` in ${categoryLabels[activeCategory]}` : ""} yet.
          </p>
          <Link href="/labs" className="mt-2 inline-block text-sm text-primary hover:underline">
            See what&rsquo;s in Labs &rarr;
          </Link>
        </div>
      )}
    </div>
  );
}
