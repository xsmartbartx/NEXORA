import type { Metadata } from "next";
import { getPlansForProduct, PRODUCT_IDS } from "@nexora/billing/plans";
import { BundleBuilder, type BundleProductPlans } from "./bundle-builder";

export const metadata: Metadata = {
  title: "Bundle Builder",
  description:
    "Pick two or three of Sentinel, CSPM and Gateway and check out together for a combined discount instead of subscribing to each one separately.",
};

const productLabel: Record<string, string> = {
  sentinel: "Sentinel",
  cspm: "CSPM",
  gateway: "Gateway",
};

export default function BundlesPage() {
  // Free tiers are excluded — a "bundle" of free plans has nothing to
  // discount or check out. Only the priced tiers make sense here.
  const productsPlans: BundleProductPlans[] = PRODUCT_IDS.map((product) => ({
    product,
    label: productLabel[product] ?? product,
    tiers: getPlansForProduct(product)
      .filter((plan) => plan.id !== "free")
      .map((plan) => ({
        id: plan.id,
        name: plan.name,
        monthlyCents: plan.priceCents.month,
        yearlyCents: plan.priceCents.year,
      })),
  }));

  return (
    <div className="mx-auto max-w-4xl px-6 py-20">
      <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        Bundle Builder
      </span>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">Build your NEXORA stack</h1>
      <p className="mt-4 max-w-2xl text-lg text-pretty text-muted-foreground">
        Pick two or three products and check out together — one subscription, one combined price, a
        real discount for buying them at once. Each product still keeps its own tier and quota.
      </p>

      <BundleBuilder products={productsPlans} />
    </div>
  );
}
