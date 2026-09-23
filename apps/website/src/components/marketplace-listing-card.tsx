import Link from "next/link";
import { Badge } from "@nexora/ui";
import type { MarketplaceListing } from "@nexora/registry";

export function MarketplaceListingCard({ listing }: { listing: MarketplaceListing }) {
  return (
    <Link
      href={listing.link}
      className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/50"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-semibold text-foreground group-hover:text-primary">
          {listing.name}
        </h3>
        {listing.provider === "partner" ? <Badge variant="neutral">Partner</Badge> : null}
      </div>
      <p className="text-sm text-muted-foreground">{listing.tagline}</p>
    </Link>
  );
}
