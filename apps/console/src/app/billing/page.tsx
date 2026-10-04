import type { Metadata } from "next";
import Link from "next/link";
import { requireOrg } from "@nexora/auth/server";
import {
  EXTERNALLY_ENFORCED_PRODUCT_IDS,
  getOrgPlan,
  getOrgSubscription,
  getPlansForProduct,
  PRODUCT_IDS,
  type Plan,
  type ProductId,
} from "@nexora/billing";
import { countOrgEvents, startOfCurrentBillingPeriod } from "@nexora/telemetry";
import { Badge, buttonVariants, cn } from "@nexora/ui";
import type { Subscription } from "@nexora/database";
import { CheckoutButton } from "./checkout-button";
import { openBillingPortal } from "./actions";
import { IndependentProducts } from "./independent-products";

export const metadata: Metadata = {
  title: "Billing",
};

interface ProductBillingData {
  product: ProductId;
  plan: Plan;
  subscription: Subscription | null;
  tiers: Plan[];
  used: number;
}

// Data fetching is deliberately kept out of any JSX — React doesn't render
// synchronously, so a try/catch wrapped around JSX construction wouldn't
// actually protect rendering (caught by react-hooks/error-boundaries).
async function loadBillingData(orgId: string): Promise<ProductBillingData[] | null> {
  try {
    const periodStart = startOfCurrentBillingPeriod();
    return await Promise.all(
      PRODUCT_IDS.map(async (product) => {
        const [plan, subscription] = await Promise.all([
          getOrgPlan(orgId, product),
          getOrgSubscription(orgId, product),
        ]);
        const [feature] = Object.keys(plan.limits);
        // Core only sees usage its own products report. Vigilo enforces and counts its
        // scans itself, so a count here would always read 0 and mislead.
        const used =
          feature && !(EXTERNALLY_ENFORCED_PRODUCT_IDS as string[]).includes(product)
            ? await countOrgEvents(orgId, `${feature}.completed`, periodStart)
            : 0;
        return { product, plan, subscription, tiers: getPlansForProduct(product), used };
      }),
    );
  } catch {
    return null;
  }
}

export default async function BillingPage(props: PageProps<"/billing">) {
  const { orgId, orgRole } = await requireOrg();
  const data = await loadBillingData(orgId);
  const searchParams = await props.searchParams;
  const checkoutStatus = searchParams.checkout;
  const hasAnySubscription = data?.some((d) => d.subscription) ?? false;

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        Billing
      </span>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Billing</h1>
      <p className="mt-2 max-w-xl text-muted-foreground">
        Sentinel, CSPM, Gateway and Vigilo are billed independently — pick the tier each one needs.
      </p>

      {checkoutStatus === "success" ? (
        <p className="mt-4 rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
          Checkout complete — Stripe&rsquo;s webhook updates your plan within a few seconds.
        </p>
      ) : checkoutStatus === "cancelled" ? (
        <p className="mt-4 rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          Checkout cancelled — your plan hasn&rsquo;t changed.
        </p>
      ) : null}

      <div className="mt-8">
        {data === null ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            Database not reachable. Set DATABASE_URL to a real Postgres instance to see billing.
          </div>
        ) : (
          <div className="flex flex-col gap-10">
            {data.map((entry) => (
              <ProductBilling
                key={entry.product}
                data={entry}
                isOrgAdmin={orgRole === "org:admin"}
              />
            ))}
          </div>
        )}
      </div>

      {hasAnySubscription ? (
        <div className="mt-10 border-t border-border pt-6">
          {orgRole === "org:admin" ? (
            <form action={openBillingPortal}>
              <button type="submit" className={cn(buttonVariants({ variant: "secondary" }))}>
                Manage or cancel in Stripe
              </button>
              <p className="mt-2 text-xs text-muted-foreground">
                Change card, download invoices, or cancel any product&rsquo;s subscription — one
                portal for every product above. After cancelling a product you keep it until the end
                of its paid period.
              </p>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">
              Ask an organisation admin to change or cancel a subscription.
            </p>
          )}
        </div>
      ) : null}

      <div className="mt-12 border-t border-border pt-8">
        <h2 className="text-lg font-semibold">Close account</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Deleting your organisation cancels every paid Sentinel, CSPM, Gateway and Vigilo
          subscription immediately and permanently deletes its API keys, usage history and billing
          state. NeuraWall below is not affected — cancel it in its own app. Admins can do this from
          the organisation settings.
        </p>
        <Link
          href="/organisation"
          className="mt-4 inline-block text-sm font-medium text-destructive hover:underline"
        >
          Go to organisation settings to delete it
        </Link>
      </div>

      <div className="mt-12 border-t border-border pt-8">
        <IndependentProducts />
      </div>
    </div>
  );
}

const productLabel: Record<ProductId, string> = {
  sentinel: "Sentinel",
  cspm: "CSPM",
  gateway: "Gateway",
  vigilo: "Vigilo",
};

function ProductBilling({ data, isOrgAdmin }: { data: ProductBillingData; isOrgAdmin: boolean }) {
  const { product, plan, subscription, tiers, used } = data;
  const [feature] = Object.keys(plan.limits);
  const limit = feature ? plan.limits[feature] : null;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{productLabel[product]}</h2>
        {subscription ? (
          <Badge variant="brand">{subscription.status}</Badge>
        ) : (
          <Badge variant="neutral">free</Badge>
        )}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {plan.name} plan —{" "}
        {(EXTERNALLY_ENFORCED_PRODUCT_IDS as string[]).includes(product)
          ? `${limit === null ? "unlimited scans" : `${limit} scans / month`} · usage is shown in ${productLabel[product]}`
          : `${used}${limit === null ? "" : ` / ${limit}`} used this period`}
        {subscription?.currentPeriodEnd
          ? ` · renews ${subscription.currentPeriodEnd.toLocaleDateString()}`
          : ""}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {tiers.map((tier) => {
          const isCurrent = tier.id === plan.id;
          const [tierFeature] = Object.keys(tier.limits);
          const tierLimit = tierFeature ? tier.limits[tierFeature] : null;
          return (
            <div
              key={tier.id}
              className={cn(
                "flex flex-col rounded-lg border p-3",
                isCurrent ? "border-primary/60 bg-primary/5" : "border-border",
              )}
            >
              <p className="text-sm font-semibold">{tier.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {tierLimit === null ? "Unlimited" : tierLimit.toLocaleString("en-US")}
              </p>
              {isCurrent ? (
                <p className="mt-2 text-xs font-medium text-primary">Current</p>
              ) : isOrgAdmin ? (
                <div className="mt-2">
                  <CheckoutButton plan={tier} />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
