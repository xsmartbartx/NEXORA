import type { Metadata } from "next";
import { requireOrg } from "@nexora/auth/server";
import { listOrgEvents } from "@nexora/telemetry";
import { Alert } from "@nexora/ui";
import { EventFilter } from "./event-filter";

export const metadata: Metadata = {
  title: "Usage",
};

export default async function UsagePage() {
  const { orgId } = await requireOrg();

  let events;
  let dbError: string | null = null;
  try {
    events = await listOrgEvents(orgId);
  } catch {
    // Same placeholder-DATABASE_URL degrade as the API Keys page.
    dbError = "Database not reachable. Set DATABASE_URL to a real Postgres instance to see usage.";
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        Usage
      </span>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Usage</h1>
      <p className="mt-2 max-w-xl text-muted-foreground">
        Every event your organisation&rsquo;s products and API keys have emitted (C-EVENT, §4.2) —
        scoped to this organisation only.
      </p>

      <div className="mt-8">
        {dbError ? (
          <Alert>{dbError}</Alert>
        ) : events && events.length > 0 ? (
          <EventFilter events={events} />
        ) : (
          <Alert>
            Nothing yet — usage appears here as soon as your organisation uses an API key or a
            product.
          </Alert>
        )}
      </div>
    </div>
  );
}
