import type { Metadata } from "next";
import Link from "next/link";
import { categoryLabels, getAllProducts } from "@nexora/registry";
import { platformLinks } from "@nexora/shell";
import { requireOrg } from "@nexora/auth/server";
import { LifecycleBadge } from "./lifecycle-badge";

export const metadata: Metadata = {
  title: "Products",
};

export default async function ConsoleProductsPage() {
  await requireOrg();
  const products = getAllProducts();
  const links = platformLinks();

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        Console
      </span>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Products</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        Every NEXORA product tile, driven by the same registry as the public catalogue. See{" "}
        <Link href="/billing" className="text-primary hover:underline">
          Billing
        </Link>{" "}
        for your plan&rsquo;s limits and{" "}
        <Link href="/analytics" className="text-primary hover:underline">
          Analytics
        </Link>{" "}
        for usage per product.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <a
            key={product.id}
            href={`${links.website}/products/${product.slug}`}
            className="flex flex-col gap-3 rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/50"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                  {categoryLabels[product.category]}
                </p>
                <h2 className="mt-1 text-lg font-semibold">{product.short_name}</h2>
              </div>
              <LifecycleBadge lifecycle={product.lifecycle} />
            </div>
            <p className="text-sm text-muted-foreground">{product.tagline}</p>
          </a>
        ))}
      </div>
    </div>
  );
}
