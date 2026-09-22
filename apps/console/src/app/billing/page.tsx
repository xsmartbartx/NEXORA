import type { Metadata } from "next";
import { requireOrg } from "@nexora/auth/server";

export const metadata: Metadata = {
  title: "Billing",
};

export default async function BillingPage() {
  await requireOrg();
  return (
    <div className="mx-auto max-w-2xl px-6 py-20 text-center">
      <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        Billing
      </span>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">No plan yet — nothing to bill.</h1>
      <p className="mt-3 text-muted-foreground">
        Plans, entitlements and the payment provider integration land in Phase 5, once there is a
        product worth paying for.
      </p>
    </div>
  );
}
