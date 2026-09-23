import type { Metadata } from "next";
import Link from "next/link";
import {
  getMarketplaceListingsByKind,
  getPublicProducts,
  marketplaceKindLabels,
  type MarketplaceListingKind,
} from "@nexora/registry";
import { ProductCard } from "@/components/product-card";
import { MarketplaceListingCard } from "@/components/marketplace-listing-card";

export const metadata: Metadata = {
  title: "Marketplace",
  description: "Every NEXORA app, API, agent, model, integration and tool, in one taxonomy.",
};

const listingKinds = Object.keys(marketplaceKindLabels) as MarketplaceListingKind[];

export default function MarketplacePage() {
  const apps = getPublicProducts();

  return (
    <div className="mx-auto max-w-6xl px-6 py-20">
      <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        Ecosystem
      </span>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">Marketplace</h1>
      <p className="mt-4 max-w-2xl text-lg text-pretty text-muted-foreground">
        Everything that plugs into NEXORA, grouped by what it is — not just apps. A category with
        nothing in it yet is shown honestly, not hidden: the taxonomy exists so the first real
        listing in it is a data change, not a rebuild.
      </p>

      <div className="mt-12">
        <h2 className="text-xl font-semibold">Apps</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Full NEXORA products — see the{" "}
          <Link href="/products" className="text-primary hover:underline">
            Products
          </Link>{" "}
          catalogue for the complete picture, including lifecycle and category filters.
        </p>
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {apps.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>

      {listingKinds.map((kind) => {
        const listings = getMarketplaceListingsByKind(kind);
        return (
          <div key={kind} className="mt-16">
            <h2 className="text-xl font-semibold">{marketplaceKindLabels[kind]}</h2>
            {listings.length > 0 ? (
              <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {listings.map((listing) => (
                  <MarketplaceListingCard key={listing.id} listing={listing} />
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">Nothing listed here yet.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
