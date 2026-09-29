import { categoryLabels, productHref, type Product } from "@nexora/registry";
import { cardVariants } from "@nexora/ui";
import Link from "next/link";
import { LifecycleBadge } from "./lifecycle-badge";

export function ProductCard({ product }: { product: Product }) {
  return (
    <Link
      href={productHref(product)}
      className={cardVariants({ interactive: true, className: "group flex flex-col gap-3" })}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            {categoryLabels[product.category]}
          </p>
          <h3 className="mt-1 text-lg font-semibold text-foreground group-hover:text-primary">
            {product.short_name}
          </h3>
        </div>
        <LifecycleBadge lifecycle={product.lifecycle} />
      </div>
      <p className="text-sm text-muted-foreground">{product.tagline}</p>
    </Link>
  );
}
