import type { Metadata } from "next";
import { requireOrg } from "@nexora/auth/server";

export const metadata: Metadata = {
  title: "Usage",
};

export default async function UsagePage() {
  await requireOrg();
  return (
    <div className="mx-auto max-w-2xl px-6 py-20 text-center">
      <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        Usage
      </span>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">
        Nothing to report yet.
      </h1>
      <p className="mt-3 text-muted-foreground">
        Usage is built from the Telemetry events every product emits (C-EVENT,
        §4.2). It fills in as products come online in Phase 4.
      </p>
    </div>
  );
}
