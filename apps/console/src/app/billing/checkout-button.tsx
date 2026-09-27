import { buttonVariants, cn } from "@nexora/ui";
import { isStripeConfigured, type Plan } from "@nexora/billing";
import { startCheckout } from "./actions";

/**
 * A plain server-rendered form — Stripe's hosted Checkout needs no
 * client-side SDK, so this never has to be a client component. The whole
 * flow is: submit → server action creates a Checkout Session → redirect to
 * Stripe → Stripe redirects back to `successUrl`/`cancelUrl`.
 */
export function CheckoutButton({ plan }: { plan: Plan }) {
  if (!isStripeConfigured()) {
    return (
      <p className="text-sm text-muted-foreground">
        Checkout isn&rsquo;t configured yet — set STRIPE_SECRET_KEY.
      </p>
    );
  }

  const { month, year } = plan.priceCents;
  return (
    <div className="flex flex-wrap gap-3">
      {plan.stripePriceIds.month ? (
        <form action={startCheckout}>
          <input type="hidden" name="interval" value="month" />
          <button type="submit" className={cn(buttonVariants({ size: "md" }))}>
            Upgrade to {plan.name} — {formatUsd(month)}/month
          </button>
        </form>
      ) : null}
      {plan.stripePriceIds.year ? (
        <form action={startCheckout}>
          <input type="hidden" name="interval" value="year" />
          <button
            type="submit"
            className={cn(buttonVariants({ size: "md", variant: "secondary" }))}
          >
            {formatUsd(year)}/year — 2 months free
          </button>
        </form>
      ) : null}
    </div>
  );
}

function formatUsd(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US")}`;
}
