import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@nexora/auth/server";
import {
  STUCK_AFTER_MINUTES,
  collect,
  collectStripeDelivery,
  collectStripeEndpoints,
  collectVigiloSync,
} from "@nexora/admin";
import { AdminNav } from "../admin-nav";
import { ago } from "../control-center/format";
import { Dot, Section, Stat, TileBody } from "../control-center/panels";

export const metadata: Metadata = {
  title: "Admin — Webhooks",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function WebhooksPage() {
  await requireAdmin();
  const [endpoints, delivery, sync] = await Promise.all([
    collect(collectStripeEndpoints),
    collect(collectStripeDelivery),
    collect(collectVigiloSync),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <span className="font-mono text-xs uppercase tracking-widest text-warning">NEXORA Staff</span>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Webhooks</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Billing depends on Stripe reaching NEXORA, and on NEXORA telling Vigilo about plan changes.
        Stripe silently disables an endpoint after repeated failures, so a disabled endpoint is the
        thing to catch here. Clerk deliveries are not shown: Clerk exposes them only in its own
        dashboard under Webhooks.
      </p>
      <AdminNav current="/admin/webhooks" />

      <Section title="Stripe endpoints">
        <TileBody tile={endpoints} label="Stripe endpoints">
          {(summary) => (
            <>
              {summary.disabled > 0 ? (
                <p
                  role="alert"
                  className="mb-3 rounded-xl border border-destructive/50 p-3 text-sm font-medium text-destructive"
                >
                  {summary.disabled} endpoint{summary.disabled === 1 ? " is" : "s are"} disabled by
                  Stripe and receiving nothing. Re-enable it in the Stripe dashboard once the cause
                  is fixed.
                </p>
              ) : null}
              {summary.disabledDuplicates > 0 ? (
                <p className="mb-3 rounded-xl border border-border p-3 text-sm text-muted-foreground">
                  {summary.disabledDuplicates} disabled endpoint
                  {summary.disabledDuplicates === 1 ? " duplicates" : "s duplicate"} a working one
                  at the same URL. It receives nothing and is harmless; it can be deleted in the
                  Stripe dashboard to keep this list clean.
                </p>
              ) : null}
              {summary.endpoints.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                  No webhook endpoints are registered in Stripe.
                </p>
              ) : (
                <ul className="divide-y divide-border rounded-xl border border-border">
                  {summary.endpoints.map((endpoint) => (
                    <li
                      key={endpoint.url}
                      className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm"
                    >
                      <span className="flex items-center gap-2 font-mono text-xs">
                        <Dot
                          tone={endpoint.enabled ? "good" : endpoint.shadowed ? "neutral" : "bad"}
                          label={endpoint.enabled ? "enabled" : "disabled"}
                        />
                        {endpoint.url}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {endpoint.enabled
                          ? "enabled"
                          : endpoint.shadowed
                            ? "disabled duplicate"
                            : "DISABLED"}{" "}
                        ·{" "}
                        {endpoint.events === "all"
                          ? "all events"
                          : `${endpoint.events} event types`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </TileBody>
      </Section>

      <Section
        title="Stripe deliveries"
        description={`Recent events and any still undelivered after ${STUCK_AFTER_MINUTES} minutes (being retried or failing).`}
      >
        <TileBody tile={delivery} label="Stripe deliveries">
          {(summary) => (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <Stat
                  label="Events (24h)"
                  value={`${summary.events24h}${summary.capped ? "+" : ""}`}
                >
                  {summary.topTypes[0]
                    ? `most: ${summary.topTypes[0].type} (${summary.topTypes[0].count})`
                    : "none in the last day"}
                </Stat>
                <Stat
                  label="Undelivered"
                  value={summary.stuck.length}
                  tone={summary.stuck.length === 0 ? "good" : "bad"}
                >
                  waiting more than {STUCK_AFTER_MINUTES} minutes
                </Stat>
              </div>
              {summary.stuck.length > 0 ? (
                <ul className="mt-3 divide-y divide-border rounded-xl border border-border text-sm">
                  {summary.stuck.map((event) => (
                    <li key={event.id} className="flex flex-wrap justify-between gap-2 p-3">
                      <span className="font-mono text-xs">{event.type}</span>
                      <span className="text-xs text-muted-foreground">
                        {event.id} · {event.ageMinutes} min · {event.pendingWebhooks} pending
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          )}
        </TileBody>
      </Section>

      <Section
        title="Vigilo plan sync"
        description="NEXORA telling Vigilo an organisation's plan after a subscription change. A failed sync makes Stripe redeliver the event; the log records each attempt."
      >
        <TileBody tile={sync} label="Vigilo plan sync">
          {(summary) => (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <Stat label="Synced (7 days)" value={summary.success7d} tone="good">
                  {summary.lastSuccess ? `last ${ago(summary.lastSuccess)}` : "none yet"}
                </Stat>
                <Stat
                  label="Failed (7 days)"
                  value={summary.failure7d}
                  tone={summary.failure7d === 0 ? "good" : "bad"}
                >
                  {summary.lastFailure ? `last ${ago(summary.lastFailure.at)}` : "no failures"}
                </Stat>
              </div>
              {summary.lastFailure ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  Last failure: {summary.lastFailure.error ?? "no detail recorded"}
                  {summary.lastFailure.orgId ? (
                    <>
                      {" "}
                      for{" "}
                      <Link
                        href={`/admin/${summary.lastFailure.orgId}`}
                        className="text-link hover:underline"
                      >
                        {summary.lastFailure.orgId.slice(0, 14)}…
                      </Link>
                    </>
                  ) : null}
                  .{" "}
                  <Link
                    href="/admin/logs?ns=billing&window=720"
                    className="text-link hover:underline"
                  >
                    See in Logs →
                  </Link>
                </p>
              ) : null}
            </>
          )}
        </TileBody>
      </Section>
    </div>
  );
}
