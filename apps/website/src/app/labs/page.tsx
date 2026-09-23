import type { Metadata } from "next";
import Link from "next/link";
import { getExperiments, getLabsProducts } from "@nexora/registry";
import { ProductCard } from "@/components/product-card";

export const metadata: Metadata = {
  title: "Labs",
  description: "Experiments, research and products building in the open, with no SLA.",
};

const kindLabel = { research: "Research", "open-source": "Open source" } as const;

export default function LabsPage() {
  const products = getLabsProducts();
  const experiments = getExperiments();

  return (
    <div className="mx-auto max-w-6xl px-6 py-20">
      <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        Labs
      </span>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">
        Building in the open, no SLA attached.
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-pretty text-muted-foreground">
        Labs is where a future NEXORA product proves itself before it earns a registry promotion to
        beta, and where research write-ups and open-source components live even when they aren&rsquo;t
        a product at all. Nothing here carries an uptime commitment.
      </p>

      {products.length > 0 ? (
        <div className="mt-12">
          <h2 className="text-xl font-semibold">In progress</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      ) : null}

      {experiments.length > 0 ? (
        <div className="mt-16">
          <h2 className="text-xl font-semibold">Research &amp; open source</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {experiments.map((experiment) => (
              <Link
                key={experiment.id}
                href={experiment.link}
                className="flex flex-col gap-3 rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/50"
              >
                <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                  {kindLabel[experiment.kind]}
                </span>
                <h3 className="text-lg font-semibold text-foreground">{experiment.title}</h3>
                <p className="text-sm text-muted-foreground">{experiment.summary}</p>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {products.length === 0 && experiments.length === 0 ? (
        <p className="mt-12 text-muted-foreground">Nothing in Labs right now.</p>
      ) : null}
    </div>
  );
}
