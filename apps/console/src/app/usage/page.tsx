import type { Metadata } from "next";
import { requireOrg } from "@nexora/auth/server";
import { listOrgEvents } from "@nexora/telemetry";
import { Alert } from "@nexora/ui";
import { getLinegistUsage } from "../../lib/linegist-usage";
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

  const linegist = await getLinegistUsage(orgId);

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

      {linegist.status !== "not_configured" && (
        <section className="mt-8 rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">Linegist scans</h2>
          {linegist.status === "ok" ? (
            <p className="mt-2 text-sm text-muted-foreground">
              <span className="font-mono text-foreground">
                {linegist.usage.scansUsed} / {linegist.usage.scansLimit}
              </span>{" "}
              scans used in {linegist.usage.period} on the {linegist.usage.plan} plan. Resets on the
              1st (UTC); Linegist stops at the cap and never bills overage.
            </p>
          ) : linegist.status === "not_started" ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Not started: your organisation hasn&rsquo;t opened Linegist yet.
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Linegist usage is temporarily unavailable. Try again in a minute.
            </p>
          )}
        </section>
      )}

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
