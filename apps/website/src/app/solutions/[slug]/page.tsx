import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonVariants } from "@nexora/ui";
import { getProductsByPillar, pillarLabels } from "@nexora/registry";
import { getSolution, solutions } from "@/lib/nav";
import { ProductCard } from "@/components/product-card";

export function generateStaticParams() {
  return solutions.map((solution) => ({ slug: solution.slug }));
}

export async function generateMetadata(props: PageProps<"/solutions/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const solution = getSolution(slug);
  if (!solution) return {};
  return { title: solution.title, description: solution.description };
}

export default async function SolutionPage(props: PageProps<"/solutions/[slug]">) {
  const { slug } = await props.params;
  const solution = getSolution(slug);
  if (!solution) notFound();

  const products = solution.pillars.flatMap((pillar) => getProductsByPillar(pillar));
  const uniqueProducts = Array.from(new Map(products.map((p) => [p.id, p])).values());

  return (
    <div className="mx-auto max-w-3xl px-6 py-20">
      <Link href="/solutions" className="text-sm text-muted-foreground hover:text-foreground">
        &larr; Solutions
      </Link>

      <div className="mt-4 flex gap-2">
        {solution.pillars.map((pillar) => (
          <span
            key={pillar}
            className="rounded-full border border-border px-2 py-0.5 font-mono text-xs uppercase tracking-widest text-muted-foreground"
          >
            {pillarLabels[pillar]}
          </span>
        ))}
      </div>

      <h1 className="mt-3 text-4xl font-semibold tracking-tight">{solution.title}</h1>
      <p className="mt-4 text-lg text-pretty text-muted-foreground">{solution.description}</p>

      {uniqueProducts.length > 0 ? (
        <div className="mt-12">
          <h2 className="text-xl font-semibold">Relevant products</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            {uniqueProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-12">
        <Link href="/company#contact" className={buttonVariants({ size: "lg" })}>
          Start a project
        </Link>
      </div>
    </div>
  );
}
