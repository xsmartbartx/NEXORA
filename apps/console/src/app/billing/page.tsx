import type { Metadata } from "next";
import { requireOrg } from "@nexora/auth/server";
import { getOrgPlan, getOrgSubscription, PLANS } from "@nexora/billing";
import { countOrgEvents, startOfCurrentBillingPeriod } from "@nexora/telemetry";
import { Badge } from "@nexora/ui";
import { CheckoutButton } from "./checkout-button";

export const metadata: Metadata = {
  title: "Billing",
};

export default async function BillingPage() {
  const { orgId } = await requireOrg();

  let content;
  try {
    const [plan, subscription] = await Promise.all([getOrgPlan(orgId), getOrgSubscription(orgId)]);
    const periodStart = startOfCurrentBillingPeriod();
    const usageEntries = await Promise.all(
      Object.entries(plan.limits).map(async ([feature, limit]) => ({
        feature,
        limit,
        used: await countOrgEvents(orgId, `${feature}.completed`, periodStart),
      })),
    );

    const proPlan = PLANS.find((p) => p.id === "pro");
    const canUpgrade = plan.id !== "pro" && proPlan?.paddlePriceId;

    content = (
      <>
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Current plan</p>
              <p className="mt-1 text-2xl font-semibold">{plan.name}</p>
            </div>
            {subscription ? <Badge variant="brand">{subscription.status}</Badge> : <Badge variant="neutral">no subscription</Badge>}
          </div>
          {subscription?.currentPeriodEnd ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Renews {subscription.currentPeriodEnd.toLocaleDateString()}
            </p>
          ) : null}
          {canUpgrade ? (
            <div className="mt-6">
              <CheckoutButton priceId={proPlan!.paddlePriceId!} orgId={orgId} />
            </div>
          ) : !proPlan?.paddlePriceId ? (
            <p className="mt-6 text-sm text-muted-foreground">
              Upgrading isn&rsquo;t available yet — PADDLE_PRICE_ID_PRO isn&rsquo;t configured.
            </p>
          ) : null}
        </div>

        <div className="mt-8">
          <h2 className="text-lg font-semibold">Usage this period</h2>
          <div className="mt-4 flex flex-col divide-y divide-border rounded-xl border border-border">
            {usageEntries.map((entry) => (
              <div key={entry.feature} className="flex items-center justify-between gap-4 p-4">
                <span className="font-mono text-sm">{entry.feature}</span>
                <span className="text-sm text-muted-foreground">
                  {entry.used} {entry.limit === null ? "" : `/ ${entry.limit}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      </>
    );
  } catch {
    content = (
      <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
        Database not reachable. Set DATABASE_URL to a real Postgres instance to see billing.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        Billing
      </span>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Billing</h1>
      <p className="mt-2 max-w-xl text-muted-foreground">
        Plan names and limits are placeholders (§4.1: Billing feeds
        Entitlements) — see{" "}
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
          packages/billing/src/plans.ts
        </code>
        .
      </p>
      <div className="mt-8">{content}</div>
    </div>
  );
}
