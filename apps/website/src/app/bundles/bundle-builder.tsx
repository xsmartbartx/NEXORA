"use client";

import { useMemo, useState } from "react";
import { bundleDiscountPercent, type NativeProductId as ProductId } from "@nexora/billing/plans";
import { buttonVariants, Card, cn } from "@nexora/ui";

export interface BundleTier {
  id: string;
  name: string;
  monthlyCents: number;
  yearlyCents: number;
}

export interface BundleProductPlans {
  product: ProductId;
  label: string;
  /** Paid tiers only (Free excluded) — the caller filters these before passing them in. */
  tiers: BundleTier[];
}

const consoleUrl = process.env.NEXT_PUBLIC_CONSOLE_URL ?? "https://console.onenexora.com";

function formatUsd(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

export function BundleBuilder({ products }: { products: BundleProductPlans[] }) {
  // productId -> selected tier id, or undefined when unchecked.
  const [selected, setSelected] = useState<Partial<Record<ProductId, string>>>({});
  const [interval, setIntervalValue] = useState<"month" | "year">("month");

  function toggleProduct(product: BundleProductPlans, checked: boolean) {
    setSelected((prev) => {
      const next = { ...prev };
      if (checked) {
        next[product.product] = product.tiers[1]?.id ?? product.tiers[0]!.id; // default to "Pro" (index 1) when available
      } else {
        delete next[product.product];
      }
      return next;
    });
  }

  function setTier(product: ProductId, tierId: string) {
    setSelected((prev) => ({ ...prev, [product]: tierId }));
  }

  const chosen = useMemo(
    () =>
      products
        .filter((p) => selected[p.product])
        .map((p) => ({
          product: p,
          tier: p.tiers.find((t) => t.id === selected[p.product])!,
        })),
    [products, selected],
  );

  const listCents = chosen.reduce(
    (sum, { tier }) => sum + (interval === "year" ? tier.yearlyCents : tier.monthlyCents),
    0,
  );
  const discountPct = bundleDiscountPercent(chosen.length);
  const discountCents = Math.round((listCents * discountPct) / 100);
  const totalCents = listCents - discountCents;

  const canCheckout = chosen.length >= 2;
  const checkoutItems = JSON.stringify(
    chosen.map(({ product, tier }) => ({ product: product.product, tier: tier.id })),
  );
  const checkoutHref = `${consoleUrl}/billing/bundle?items=${encodeURIComponent(checkoutItems)}&interval=${interval}`;

  return (
    <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-4">
        {products.map((product) => {
          const isChecked = Boolean(selected[product.product]);
          const tierId = selected[product.product];
          return (
            <Card key={product.product} className={cn(isChecked && "border-primary/60")}>
              {/* Not a <label> wrapping the tier buttons too: a label forwards
                  clicks anywhere inside it to its checkbox, which would
                  toggle the product off/on every time a tier button is
                  clicked. Only the checkbox and its own name are linked. */}
              <div className="flex items-start gap-3">
                <input
                  id={`bundle-${product.product}`}
                  type="checkbox"
                  checked={isChecked}
                  onChange={(e) => toggleProduct(product, e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-border accent-primary"
                />
                <div className="flex-1">
                  <label
                    htmlFor={`bundle-${product.product}`}
                    className="cursor-pointer font-semibold"
                  >
                    {product.label}
                  </label>
                  {isChecked ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {product.tiers.map((tier) => (
                        <button
                          key={tier.id}
                          type="button"
                          onClick={() => setTier(product.product, tier.id)}
                          className={cn(
                            "rounded-md border px-3 py-1.5 text-sm",
                            tierId === tier.id
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {tier.name} —{" "}
                          {formatUsd(interval === "year" ? tier.yearlyCents : tier.monthlyCents)}
                          {interval === "year" ? "/yr" : "/mo"}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-1 text-sm text-muted-foreground">
                      From {formatUsd(product.tiers[0]!.monthlyCents)}/mo
                    </p>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="lg:sticky lg:top-6 lg:self-start">
        <Card>
          <div className="flex items-center justify-between">
            <p className="font-semibold">Your bundle</p>
            <div className="flex rounded-md border border-border p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setIntervalValue("month")}
                className={cn(
                  "rounded px-2 py-1",
                  interval === "month"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground",
                )}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setIntervalValue("year")}
                className={cn(
                  "rounded px-2 py-1",
                  interval === "year"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground",
                )}
              >
                Yearly
              </button>
            </div>
          </div>

          {chosen.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Check at least two products to see your bundle price.
            </p>
          ) : (
            <div className="mt-4 flex flex-col gap-2 text-sm">
              {chosen.map(({ product, tier }) => (
                <div key={product.product} className="flex justify-between">
                  <span className="text-muted-foreground">
                    {product.label} {tier.name}
                  </span>
                  <span>
                    {formatUsd(interval === "year" ? tier.yearlyCents : tier.monthlyCents)}
                  </span>
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
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Add one more product to unlock a bundle discount.
                  </p>
                )}
              </div>

              <div className="mt-2 flex items-baseline justify-between border-t border-border pt-2">
                <span className="font-semibold">
                  You pay {interval === "year" ? "/ year" : "/ month"}
                </span>
                <span className="text-2xl font-semibold tracking-tight">
                  {formatUsd(totalCents)}
                </span>
              </div>
            </div>
          )}

          {canCheckout ? (
            <a href={checkoutHref} className={cn(buttonVariants({ size: "md" }), "mt-6 w-full")}>
              Continue to checkout
            </a>
          ) : (
            <button
              type="button"
              disabled
              className={cn(buttonVariants({ size: "md" }), "mt-6 w-full opacity-50")}
            >
              Pick 2+ products
            </button>
          )}
        </Card>
      </div>
    </div>
  );
}
