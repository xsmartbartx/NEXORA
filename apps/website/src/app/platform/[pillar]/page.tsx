import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getProductsByPillar,
  pillarLabels,
  pillarTaglines,
  type PlatformPillar,
} from "@nexora/registry";
import { platformPillarSlugs, solutions } from "@/lib/nav";
import { ProductCard } from "@/components/product-card";

function isPillar(value: string): value is PlatformPillar {
  return (platformPillarSlugs as string[]).includes(value);
}

export function generateStaticParams() {
  return platformPillarSlugs.map((pillar) => ({ pillar }));
}

export async function generateMetadata(props: PageProps<"/platform/[pillar]">): Promise<Metadata> {
  const { pillar } = await props.params;
  if (!isPillar(pillar)) return {};
  return {
    title: pillarLabels[pillar],
    description: pillarTaglines[pillar],
  };
}

export default async function PillarPage(props: PageProps<"/platform/[pillar]">) {
  const { pillar } = await props.params;
  if (!isPillar(pillar)) notFound();

  const products = getProductsByPillar(pillar);
  const relatedSolutions = solutions.filter((s) => s.pillars.includes(pillar));

  return (
    <div className="mx-auto max-w-4xl px-6 py-20">
      <Link href="/platform" className="text-sm text-muted-foreground hover:text-foreground">
        &larr; Platform
      </Link>

      <span className="mt-4 block font-mono text-xs uppercase tracking-widest text-primary">
        Pillar
      </span>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">{pillarLabels[pillar]}</h1>
      <p className="mt-4 max-w-2xl text-lg text-muted-foreground">{pillarTaglines[pillar]}</p>

      <div className="mt-16">
        <h2 className="text-xl font-semibold">Products</h2>
        {products.length > 0 ? (
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <p className="mt-4 text-muted-foreground">
            No public product in this pillar yet. See{" "}
            <Link href="/labs" className="text-primary hover:underline">
              Labs
            </Link>{" "}
            for what is in progress.
          </p>
        )}
      </div>

      {relatedSolutions.length > 0 ? (
        <div className="mt-16">
          <h2 className="text-xl font-semibold">Related solutions</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            {relatedSolutions.map((solution) => (
              <Link
                key={solution.slug}
                href={`/solutions/${solution.slug}`}
                className="group flex flex-col gap-2 rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/50"
              >
                <span className="font-medium text-foreground group-hover:text-primary">
                  {solution.title}
                </span>
                <span className="text-sm text-muted-foreground">{solution.description}</span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
