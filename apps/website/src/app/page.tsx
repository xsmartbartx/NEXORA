import { buttonVariants, cn } from "@nexora/ui";
import {
  getFeaturedProducts,
  getLabsProducts,
  pillarLabels,
  pillarTaglines,
} from "@nexora/registry";
import Link from "next/link";
import { platformPillarSlugs } from "@/lib/nav";
import { ProductCard } from "@/components/product-card";

export default function Home() {
  const featured = getFeaturedProducts();
  const labs = getLabsProducts();

  return (
    <>
      <section className="flex flex-col items-center px-6 py-28 text-center sm:py-36">
        <div className="flex max-w-2xl flex-col items-center gap-8">
          <span className="rounded-full border border-border px-3 py-1 font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Technology · AI · Security
          </span>

          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
            Build What&rsquo;s Next.
          </h1>

          <p className="text-lg text-pretty text-muted-foreground sm:text-xl">
            NEXORA is a technology platform. Its products are intelligent software, AI systems and
            secure digital products that share one account, one console, one API surface and one
            operational backbone.
          </p>

          <div className="flex flex-col gap-4 sm:flex-row">
            <Link href="/platform" className={buttonVariants({ size: "lg" })}>
              Explore the platform
            </Link>
            <Link
              href="/company"
              className={cn(buttonVariants({ size: "lg", variant: "outline" }))}
            >
              About NEXORA
            </Link>
          </div>
        </div>
      </section>

      <section className="border-t border-border px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-semibold tracking-tight">One platform, three pillars</h2>
            <p className="max-w-2xl text-muted-foreground">
              Every product NEXORA ships belongs to one of these. Same account, same console, same
              API surface underneath all three.
            </p>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {platformPillarSlugs.map((pillar) => (
              <Link
                key={pillar}
                href={`/platform/${pillar}`}
                className="group flex flex-col gap-2 rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/50"
              >
                <span className="font-mono text-xs uppercase tracking-widest text-primary">
                  {pillarLabels[pillar]}
                </span>
                <p className="text-sm text-muted-foreground">{pillarTaglines[pillar]}</p>
                <span className="mt-2 text-sm font-medium text-foreground group-hover:text-primary">
                  Explore &rarr;
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {featured.length > 0 ? (
        <section className="border-t border-border px-6 py-20">
          <div className="mx-auto max-w-6xl">
            <div className="flex items-end justify-between gap-4">
              <h2 className="text-2xl font-semibold tracking-tight">Featured products</h2>
              <Link href="/products" className="text-sm font-medium text-primary hover:underline">
                All products &rarr;
              </Link>
            </div>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        </section>
      ) : labs.length > 0 ? (
        <section className="border-t border-border px-6 py-20">
          <div className="mx-auto max-w-6xl">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">Building in the open</h2>
                <p className="mt-2 max-w-2xl text-muted-foreground">
                  No product has graduated to a public release yet. Here&rsquo;s what is in Labs
                  today.
                </p>
              </div>
              <Link href="/labs" className="text-sm font-medium text-primary hover:underline">
                Visit Labs &rarr;
              </Link>
            </div>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {labs.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="border-t border-border px-6 py-20">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
          <h2 className="text-2xl font-semibold tracking-tight">
            The platform first, the product second.
          </h2>
          <p className="text-muted-foreground">
            Once NEXORA Core exists, every new product inherits authentication, accounts, billing,
            API keys and navigation on day one — instead of rebuilding them from zero.
          </p>
          <Link href="/company#contact" className={buttonVariants({ size: "lg" })}>
            Talk to us
          </Link>
        </div>
      </section>
    </>
  );
}
