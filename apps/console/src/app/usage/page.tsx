import type { Metadata } from "next";
import { requireOrg } from "@nexora/auth/server";
import { listOrgEvents } from "@nexora/telemetry";

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
          <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            {dbError}
          </div>
        ) : events && events.length > 0 ? (
          <div className="flex flex-col divide-y divide-border rounded-xl border border-border">
            {events.map((event) => (
              <div key={event.id} className="flex items-center justify-between gap-4 p-4">
                <div>
                  <p className="font-mono text-sm">{event.action}</p>
                  {event.resourceType ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {event.resourceType}
                      {event.resourceId ? ` · ${event.resourceId}` : ""}
                    </p>
                  ) : null}
                </div>
                <time
                  className="shrink-0 text-xs text-muted-foreground"
                  dateTime={event.createdAt.toISOString()}
                >
                  {event.createdAt.toLocaleString()}
                </time>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            Nothing yet — usage appears here as soon as your organisation uses an API key or a
            product.
          </div>
        )}
      </div>
    </div>
  );
}
