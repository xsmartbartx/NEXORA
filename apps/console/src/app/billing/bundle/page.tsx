import type { Metadata } from "next";
import Link from "next/link";
import {
  bundleDiscountPercent,
  getPlan,
  isProductId,
  type BillingInterval,
  type Plan,
  type ProductId,
} from "@nexora/billing";
import { buttonVariants, Card, cn } from "@nexora/ui";
import { startBundleCheckout } from "../actions";

export const metadata: Metadata = {
  title: "Confirm your bundle",
};

const productLabel: Record<string, string> = {
  sentinel: "Sentinel",
  cspm: "CSPM",
  gateway: "Gateway",
};

function formatUsd(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

/** Parses and re-validates the website's `items`/`interval` query params server-side — the same tamper-proofing `startBundleCheckout` applies again at submit time, this is just for an honest preview. */
function parseItems(raw: string | undefined): { product: string; tier: string }[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is { product: string; tier: string } =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as Record<string, unknown>).product === "string" &&
        typeof (entry as Record<string, unknown>).tier === "string",
    );
  } catch {
    return [];
  }
}

export default async function BundleCheckoutPage(props: PageProps<"/billing/bundle">) {
  const searchParams = await props.searchParams;
  const itemsParam = Array.isArray(searchParams.items) ? searchParams.items[0] : searchParams.items;
  const intervalParam = Array.isArray(searchParams.interval)
    ? searchParams.interval[0]
    : searchParams.interval;
  const interval: BillingInterval = intervalParam === "year" ? "year" : "month";

  const rawItems = parseItems(itemsParam);
  const resolved: { product: string; plan: Plan }[] = rawItems
    .filter((item): item is { product: ProductId; tier: string } => isProductId(item.product))
    .map((item) => ({ product: item.product, plan: getPlan(item.product, item.tier) }));

  const invalid = resolved.length < 2 || resolved.length !== rawItems.length;

  const listCents = resolved.reduce((sum, { plan }) => sum + plan.priceCents[interval], 0);
  const discountPct = bundleDiscountPercent(resolved.length);
  const discountCents = Math.round((listCents * discountPct) / 100);
  const totalCents = listCents - discountCents;

  return (
    <div className="mx-auto max-w-lg px-6 py-12">
      <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        Billing
      </span>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Confirm your bundle</h1>

      {invalid ? (
        <div className="mt-8 rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          This bundle link looks incomplete or invalid.{" "}
          <Link href="/billing" className="text-primary hover:underline">
            Go to Billing
          </Link>{" "}
          to set up each product individually, or build a fresh bundle from the pricing page.
        </div>
      ) : (
        <Card className="mt-8">
          <div className="flex flex-col gap-2 text-sm">
            {resolved.map(({ product, plan }) => (
              <div key={product} className="flex justify-between">
                <span className="text-muted-foreground">
                  {productLabel[product] ?? product} {plan.name}
                </span>
                <span>{formatUsd(plan.priceCents[interval])}</span>
              </div>
            ))}

            <div className="mt-2 border-t border-border pt-2">
              <div className="flex justify-between text-muted-foreground">
                <span>List price</span>
                <span>{formatUsd(listCents)}</span>
              </div>
              {discountPct > 0 ? (
                <div className="flex justify-between text-success">
                  <span>Bundle discount ({discountPct}%)</span>
                  <span>−{formatUsd(discountCents)}</span>
                </div>
              ) : null}
            </div>

            <div className="mt-2 flex items-baseline justify-between border-t border-border pt-2">
              <span className="font-semibold">
                Total {interval === "year" ? "/ year" : "/ month"}
              </span>
              <span className="text-2xl font-semibold tracking-tight">{formatUsd(totalCents)}</span>
            </div>
          </div>

          <form action={startBundleCheckout} className="mt-6">
            <input
              type="hidden"
              name="items"
              value={JSON.stringify(
                resolved.map(({ product, plan }) => ({ product, tier: plan.id })),
              )}
            />
            <input type="hidden" name="interval" value={interval} />
            <button type="submit" className={cn(buttonVariants({ size: "md" }), "w-full")}>
              Continue to Stripe
            </button>
          </form>
        </Card>
      )}
    </div>
  );
}
