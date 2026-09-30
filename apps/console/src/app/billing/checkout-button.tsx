import { buttonVariants, cn } from "@nexora/ui";
import { isStripeConfigured, type Plan } from "@nexora/billing";
import { startCheckout } from "./actions";

/**
 * A plain server-rendered form — Stripe's hosted Checkout needs no
 * client-side SDK, so this never has to be a client component. The whole
 * flow is: submit → server action creates a Checkout Session → redirect to
 * Stripe → Stripe redirects back to `successUrl`/`cancelUrl`. One `plan`
 * here is one specific product+tier (e.g. Sentinel Business) — the caller
 * renders one of these per paid tier it offers a switch to.
 */
export function CheckoutButton({ plan }: { plan: Plan }) {
  if (!isStripeConfigured()) {
    return (
      <p className="text-xs text-muted-foreground">
        Checkout isn&rsquo;t configured yet — set STRIPE_SECRET_KEY.
      </p>
    );
  }

  const { month, year } = plan.priceCents;
  return (
    <div className="flex flex-col gap-2">
      {plan.stripePriceIds.month ? (
        <form action={startCheckout}>
          <input type="hidden" name="product" value={plan.product} />
          <input type="hidden" name="tier" value={plan.id} />
          <input type="hidden" name="interval" value="month" />
          <button type="submit" className={cn(buttonVariants({ size: "sm" }), "w-full")}>
            {formatUsd(month)}/mo
          </button>
        </form>
      ) : null}
      {plan.stripePriceIds.year ? (
        <form action={startCheckout}>
          <input type="hidden" name="product" value={plan.product} />
          <input type="hidden" name="tier" value={plan.id} />
          <input type="hidden" name="interval" value="year" />
          <button
            type="submit"
            className={cn(buttonVariants({ size: "sm", variant: "secondary" }), "w-full")}
          >
            {formatUsd(year)}/yr — save 20%
          </button>
        </form>
      ) : null}
    </div>
  );
}

function formatUsd(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US")}`;
}
