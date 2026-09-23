"use client";

import { buttonVariants } from "@nexora/ui";
import { useState } from "react";

const clientToken = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
const environment =
  process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT === "production" ? "production" : "sandbox";

export function CheckoutButton({ priceId, orgId }: { priceId: string; orgId: string }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!clientToken) {
    return (
      <p className="text-sm text-muted-foreground">
        Checkout isn&rsquo;t configured yet — set NEXT_PUBLIC_PADDLE_CLIENT_TOKEN.
      </p>
    );
  }

  async function handleClick() {
    setIsLoading(true);
    setError(null);
    try {
      const { initializePaddle } = await import("@paddle/paddle-js");
      const paddle = await initializePaddle({
        token: clientToken!,
        environment,
        checkout: { settings: { displayMode: "overlay", theme: "dark" } },
      });
      if (!paddle) throw new Error("Paddle failed to initialize.");
      paddle.Checkout.open({
        items: [{ priceId, quantity: 1 }],
        // The webhook (apps/api/v1/webhooks/paddle) reads this back out of
        // the subscription event to know which organisation to credit —
        // Paddle has no concept of a NEXORA org on its own.
        customData: { orgId },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open checkout.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={isLoading}
        className={buttonVariants({ size: "md" })}
      >
        {isLoading ? "Loading…" : "Upgrade to Pro"}
      </button>
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
