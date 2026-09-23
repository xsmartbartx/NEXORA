import { buttonVariants, cn } from "@nexora/ui";
import { isStripeConfigured } from "@nexora/billing";
import { startCheckout } from "./actions";

/**
 * A plain server-rendered form — Stripe's hosted Checkout needs no
 * client-side SDK, so this never has to be a client component. The whole
 * flow is: submit → server action creates a Checkout Session → redirect to
 * Stripe → Stripe redirects back to `successUrl`/`cancelUrl`.
 */
export function CheckoutButton({ priceId }: { priceId: string }) {
  if (!isStripeConfigured()) {
    return (
      <p className="text-sm text-muted-foreground">
        Checkout isn&rsquo;t configured yet — set STRIPE_SECRET_KEY.
      </p>
    );
  }

  return (
    <form action={startCheckout}>
      <input type="hidden" name="priceId" value={priceId} />
      <button type="submit" className={cn(buttonVariants({ size: "md" }))}>
        Upgrade to Pro
      </button>
    </form>
  );
}
