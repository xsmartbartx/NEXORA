import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonVariants, cn } from "@nexora/ui";
import { categoryLabels, getAllProducts, getProductBySlug, pillarLabels } from "@nexora/registry";
import { LifecycleBadge } from "@/components/lifecycle-badge";

export function generateStaticParams() {
  return getAllProducts().map((product) => ({ slug: product.slug }));
}

export async function generateMetadata(props: PageProps<"/products/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const product = getProductBySlug(slug);
  if (!product) return {};
  return {
    title: product.short_name,
    description: product.tagline,
  };
}

export default async function ProductDetailPage(props: PageProps<"/products/[slug]">) {
  const { slug } = await props.params;
  const product = getProductBySlug(slug);
  if (!product) notFound();

  const isLive = product.lifecycle !== "concept" && product.lifecycle !== "alpha";

  return (
    <div className="mx-auto max-w-3xl px-6 py-20">
      <Link href="/products" className="text-sm text-muted-foreground hover:text-foreground">
        &larr; Products
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          {categoryLabels[product.category]} · {pillarLabels[product.platform_pillar]} pillar
        </span>
        <LifecycleBadge lifecycle={product.lifecycle} />
      </div>

      <h1 className="mt-3 text-4xl font-semibold tracking-tight">{product.name}</h1>
      <p className="mt-4 text-lg text-pretty text-muted-foreground">{product.tagline}</p>

      <div className="mt-8 max-w-2xl text-foreground/90">
        <p>{product.description}</p>
      </div>

      <div className="mt-10 rounded-xl border border-dashed border-border p-6">
        {isLive ? (
          <>
            <p className="text-sm text-muted-foreground">
              {product.short_name} is live. Visit the product for more.
            </p>
            <a
              href={product.url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ size: "md" }), "mt-4")}
            >
              Open {product.short_name}
            </a>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {product.short_name} is at the{" "}
              <strong className="text-foreground">{product.lifecycle}</strong> stage — in Labs, not
              yet a public release. There is no SLA and no public sign-up yet.
            </p>
            <Link href="/company#contact" className={cn(buttonVariants({ size: "md" }), "mt-4")}>
              Get in touch
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
