import type { Metadata } from "next";
import { getLabsProducts } from "@nexora/registry";
import { ProductCard } from "@/components/product-card";

export const metadata: Metadata = {
  title: "Labs",
  description: "Experiments and research building in the open, with no SLA.",
};

export default function LabsPage() {
  const products = getLabsProducts();

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
        beta. Everything here is <code>concept</code> or <code>alpha</code> stage: no public
        sign-up, no uptime commitment, and it can change or disappear.
      </p>

      {products.length > 0 ? (
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <p className="mt-12 text-muted-foreground">Nothing in Labs right now.</p>
      )}
    </div>
  );
}
