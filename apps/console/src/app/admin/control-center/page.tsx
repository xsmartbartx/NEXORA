import type { Metadata } from "next";
import { requireAdmin } from "@nexora/auth/server";
import { TOOLBOX, attentionItems, collectControlCenter, type Cadence } from "@nexora/admin";
import { Badge, Button } from "@nexora/ui";
import { AdminNav } from "../admin-nav";
import { markTaskDoneAction } from "./actions";
import { AutoRefresh } from "./auto-refresh";
import { CostLedger } from "./cost-ledger";
import { ago, money, percent } from "./format";
import { Dot, Section, Stat, TileBody, type Tone } from "./panels";

export const metadata: Metadata = {
  title: "Admin — Control Center",
  robots: { index: false, follow: false },
};

// Live probes and live money: never a build-time or cached answer.
export const dynamic = "force-dynamic";

const REFRESH_SECONDS = 60;

const statusTone = { up: "good", degraded: "warn", down: "bad" } as const;
const cadenceOrder: Cadence[] = ["daily", "weekly", "monthly"];

function healthTone(value: boolean | null): Tone {
  return value === null ? "neutral" : value ? "good" : "bad";
}

export default async function ControlCenterPage() {
  await requireAdmin();
  const snapshot = await collectControlCenter();
  const { health, application, security, business, costs, checklist } = snapshot;
  const issues = attentionItems(snapshot);
  const critical = issues.filter((issue) => issue.level === "critical").length;

  const mrr = business.revenue.state === "ok" ? business.revenue.data.mrrCents : null;
  const monthlyCost = costs.state === "ok" ? costs.data.monthlyCents : null;

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <AutoRefresh seconds={REFRESH_SECONDS} />

      <span className="font-mono text-xs uppercase tracking-widest text-warning">NEXORA Staff</span>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Control Center</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Updated {snapshot.collectedAt.toLocaleTimeString("en-GB", { timeZone: "UTC" })} UTC ·
        refreshes every {REFRESH_SECONDS}s while this tab is open. Anything not connected says so
        rather than showing a number.
      </p>
      <AdminNav current="/admin/control-center" />

      <div
        role="status"
        className={`mt-6 rounded-xl border p-4 ${
          issues.length === 0
            ? "border-success/40"
            : critical > 0
              ? "border-destructive/50"
              : "border-warning/50"
        }`}
      >
        {issues.length === 0 ? (
          <p className="flex items-center gap-2 text-sm font-medium">
            <Dot tone="good" label="healthy" /> Nothing needs attention.
          </p>
        ) : (
          <>
            <p className="text-sm font-medium">
              {issues.length} thing{issues.length === 1 ? "" : "s"} need
              {issues.length === 1 ? "s" : ""} attention
              {critical > 0 ? ` (${critical} critical)` : ""}
            </p>
            <ul className="mt-2 space-y-1 text-sm">
              {issues.map((issue) => (
                <li key={issue.text} className="flex items-start gap-2">
                  <span className="mt-1.5">
                    <Dot tone={issue.level === "critical" ? "bad" : "warn"} label={issue.level} />
                  </span>
                  {issue.text}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <Section title="Platform health">
        <TileBody tile={health.endpoints} label="Endpoints">
          {(endpoints) => (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {endpoints.map((endpoint) => (
                <div
                  key={endpoint.name}
                  className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm"
                >
                  <span className="flex items-center gap-2">
                    <Dot tone={statusTone[endpoint.status]} label={endpoint.status} />
                    {endpoint.name}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {endpoint.latencyMs === null
                      ? (endpoint.httpStatus ?? "—")
                      : `${endpoint.latencyMs} ms`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </TileBody>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <TileBody tile={health.database} label="Database (from Console)">
            {(db) => (
              <Stat label="Database (from Console)" value={`${db.latencyMs} ms`} tone="good">
                query round trip
              </Stat>
            )}
          </TileBody>
          <TileBody tile={health.infra} label="Postgres & Redis">
            {(m) => (
              <>
                <Stat
                  label="Postgres"
                  value={m.postgresUp === null ? "—" : m.postgresUp ? "Up" : "Down"}
                  tone={healthTone(m.postgresUp)}
                >
                  {m.postgresConnections === null
                    ? "no connection data"
                    : `${m.postgresConnections} connections`}
                </Stat>
                <Stat
                  label="Redis"
                  value={m.redisUp === null ? "—" : m.redisUp ? "Up" : "Down"}
                  tone={healthTone(m.redisUp)}
                >
                  {percent(m.redisMemoryPercent)} of memory limit
                </Stat>
                <Stat
                  label="Host"
                  value={`${percent(m.cpuPercent)} CPU`}
                  tone={m.cpuPercent !== null && m.cpuPercent > 90 ? "bad" : "neutral"}
                >
                  {percent(m.memoryPercent)} memory ·{" "}
                  {m.diskFreePercent === null ? "—" : `${(100 - m.diskFreePercent).toFixed(0)}%`}{" "}
                  disk used
                </Stat>
              </>
            )}
          </TileBody>
          <TileBody tile={health.backup} label="Nightly backup">
            {(backup) => (
              <Stat
                label="Nightly backup"
                value={
                  backup.status === "ok" ? "Fresh" : backup.status === "stale" ? "Stale" : "Missing"
                }
                tone={backup.status === "ok" ? "good" : "bad"}
              >
                last success {ago(backup.lastSuccess)}
              </Stat>
            )}
          </TileBody>
        </div>
      </Section>

      <Section title="Application">
        <div className="grid gap-3 sm:grid-cols-3">
          <TileBody tile={application.sentry} label="Unresolved errors (24h)">
            {(sentry) => (
              <Stat
                label="Unresolved errors (24h)"
                value={`${sentry.unresolved}${sentry.capped ? "+" : ""}`}
                tone={sentry.unresolved === 0 ? "good" : "warn"}
              >
                {sentry.top[0] ? `top: ${sentry.top[0].title.slice(0, 48)}` : "Sentry is clear"}
              </Stat>
            )}
          </TileBody>
          <TileBody tile={application.latency} label="Latency">
            {(latency) => (
              <>
                <Stat
                  label="Average latency"
                  value={latency.averageMs === null ? "—" : `${latency.averageMs} ms`}
                >
                  across {latency.sampled} endpoints
                </Stat>
                <Stat
                  label="Slowest"
                  value={latency.slowest[0] ? `${latency.slowest[0].latencyMs} ms` : "—"}
                >
                  {latency.slowest.map((s) => s.name).join(", ")}
                </Stat>
              </>
            )}
          </TileBody>
        </div>
        <TileBody tile={application.ci} label="CI on main">
          {(repos) => (
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {repos.map((repo) => (
                <div key={repo.repo} className="rounded-xl border border-border bg-card p-4">
                  <div className="text-xs text-muted-foreground">
                    {repo.repo.split("/")[1]} · main
                  </div>
                  <ul className="mt-2 space-y-1 text-sm">
                    {repo.workflows.map((workflow) => {
                      const tone: Tone =
                        workflow.conclusion === "success"
                          ? "good"
                          : workflow.conclusion === null
                            ? "neutral"
                            : workflow.conclusion === "failure"
                              ? "bad"
                              : "warn";
                      return (
                        <li key={workflow.name} className="flex items-center gap-2">
                          <Dot tone={tone} label={workflow.conclusion ?? workflow.status} />
                          <a href={workflow.url} className="hover:underline">
                            {workflow.name}
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </TileBody>
        <p className="mt-2 text-xs text-muted-foreground">
          5xx rate isn&rsquo;t shown: nothing in front of the apps exports it yet.
        </p>
      </Section>

      <Section title="Security">
        <TileBody tile={security.codeSecurity} label="Open security alerts">
          {(code) => (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <Stat
                label="Critical"
                value={code.totals.critical}
                tone={code.totals.critical ? "bad" : "good"}
              />
              <Stat
                label="High"
                value={code.totals.high}
                tone={code.totals.high ? "warn" : "good"}
              />
              <Stat label="Medium" value={code.totals.medium} />
              <Stat label="Low" value={code.totals.low} />
              <Stat
                label="Leaked secrets"
                value={code.secrets}
                tone={code.secrets ? "bad" : "good"}
              />
            </div>
          )}
        </TileBody>

        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <TileBody tile={security.certificates} label="TLS certificates">
            {(certs) => (
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="text-xs text-muted-foreground">
                  TLS certificates — soonest to expire
                </div>
                <ul className="mt-2 space-y-1 text-sm">
                  {certs.slice(0, 5).map((cert) => (
                    <li key={cert.host} className="flex justify-between">
                      <span>{cert.host}</span>
                      <span
                        className={`font-mono ${
                          cert.daysLeft === null || cert.daysLeft < 7
                            ? "text-destructive"
                            : cert.daysLeft < 21
                              ? "text-warning"
                              : "text-muted-foreground"
                        }`}
                      >
                        {cert.daysLeft === null ? "unreachable" : `${cert.daysLeft} days`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </TileBody>
          <TileBody tile={security.access} label="Access & audit">
            {(access) => (
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="text-xs text-muted-foreground">Access &amp; audit</div>
                <p className="mt-2 text-sm">
                  {access.suspendedProducts} suspended product
                  {access.suspendedProducts === 1 ? "" : "s"} · {access.failedEvents7d} failed event
                  {access.failedEvents7d === 1 ? "" : "s"} in 7 days
                </p>
                {access.recentAdminActions.length > 0 ? (
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {access.recentAdminActions.slice(0, 5).map((action, i) => (
                      <li key={i} className="flex justify-between gap-2">
                        <span className="font-mono">{action.action}</span>
                        <span>{ago(action.createdAt)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">
                    No staff actions recorded yet.
                  </p>
                )}
              </div>
            )}
          </TileBody>
        </div>
      </Section>

      <Section
        title="Business"
        description="Visitors → signups → activation → paid. Activated means an organisation has made at least one authenticated API call."
      >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <TileBody tile={business.visitors} label="Visitors">
            {() => null}
          </TileBody>
          <TileBody tile={business.clerk} label="Signups">
            {(clerk) => (
              <Stat label="Signups" value={clerk.users.toLocaleString("en-US")}>
                +{clerk.newUsers7d}
                {clerk.newUsersCapped ? "+" : ""} in 7d · {clerk.organizations} orgs
              </Stat>
            )}
          </TileBody>
          <TileBody tile={business.activation} label="Activated">
            {(activation) => (
              <Stat label="Activated orgs" value={activation.activatedOrgs}>
                {activation.activeLast7d} active in 7d · {activation.orgsWithKeys} created a key
              </Stat>
            )}
          </TileBody>
          <TileBody tile={business.revenue} label="Paid & MRR">
            {(revenue) => (
              <>
                <Stat label="Paying customers" value={revenue.payingCustomers}>
                  {revenue.activeSubscriptions} subscription
                  {revenue.activeSubscriptions === 1 ? "" : "s"}
                  {revenue.pastDue ? ` · ${revenue.pastDue} past due` : ""}
                </Stat>
                <Stat label="MRR" value={money(revenue.mrrCents)}>
                  ARR {money(revenue.arrCents)}
                </Stat>
              </>
            )}
          </TileBody>
        </div>
        {business.revenue.state === "ok" &&
        (business.revenue.data.discountsIgnored > 0 || business.revenue.data.nonUsdSkipped > 0) ? (
          <p className="mt-2 text-xs text-warning">
            MRR is approximate:{" "}
            {business.revenue.data.discountsIgnored > 0
              ? `${business.revenue.data.discountsIgnored} fixed-amount discount(s) aren't subtracted. `
              : ""}
            {business.revenue.data.nonUsdSkipped > 0
              ? `${business.revenue.data.nonUsdSkipped} non-USD subscription(s) are left out.`
              : ""}
          </p>
        ) : null}
      </Section>

      <Section
        title="Infrastructure cost"
        description="Entered by hand — there's no billing API worth wiring up for a handful of vendors. Ending a cost keeps the row, so past months stay explainable."
      >
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <Stat label="Monthly cost" value={monthlyCost === null ? "—" : money(monthlyCost)}>
            {costs.state === "ok" && costs.data.byVendor.length > 0
              ? costs.data.byVendor.map((v) => `${v.vendor} ${money(v.monthlyCents)}`).join(" · ")
              : "nothing recorded yet"}
          </Stat>
          <Stat label="MRR" value={mrr === null ? "—" : money(mrr)} />
          <Stat
            label="Margin"
            value={mrr === null || monthlyCost === null ? "—" : money(mrr - monthlyCost)}
            tone={
              mrr === null || monthlyCost === null
                ? "neutral"
                : mrr - monthlyCost >= 0
                  ? "good"
                  : "bad"
            }
          >
            MRR minus recorded costs
          </Stat>
        </div>
        <TileBody tile={costs} label="Cost ledger">
          {(ledger) => (
            <CostLedger
              entries={ledger.entries.map((e) => ({
                id: e.id,
                vendor: e.vendor,
                label: e.label,
                amountCents: e.amountCents,
                interval: e.interval,
              }))}
            />
          )}
        </TileBody>
      </Section>

      <Section
        title="Owner reviews"
        description="Recurring checks. Daily means done within the last day, weekly within 7 days, monthly within 30."
      >
        <TileBody tile={checklist} label="Owner reviews">
          {(items) => (
            <div className="grid gap-4 lg:grid-cols-3">
              {cadenceOrder.map((cadence) => (
                <div key={cadence} className="rounded-xl border border-border bg-card p-4">
                  <div className="text-xs uppercase tracking-widest text-muted-foreground">
                    {cadence}
                  </div>
                  <ul className="mt-2 space-y-3">
                    {items
                      .filter((item) => item.cadence === cadence)
                      .map((item) => (
                        <li key={item.id} className="text-sm">
                          <div className="flex items-start justify-between gap-2">
                            <a href={item.href} className="font-medium hover:underline">
                              {item.title}
                            </a>
                            <Badge
                              variant={
                                item.state === "ok"
                                  ? "success"
                                  : item.state === "due"
                                    ? "warning"
                                    : "neutral"
                              }
                            >
                              {item.state === "ok" ? "done" : item.state}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{item.detail}</p>
                          <div className="mt-1 flex items-center justify-between">
                            <span
                              className={`text-xs ${item.state === "overdue" ? "text-destructive" : "text-muted-foreground"}`}
                            >
                              last done {ago(item.lastDone)}
                            </span>
                            <form action={markTaskDoneAction.bind(null, item.id)}>
                              <Button type="submit" size="sm" variant="outline">
                                Mark done
                              </Button>
                            </form>
                          </div>
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </TileBody>
      </Section>

      <Section title="Toolbox">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLBOX.map((group) => (
            <div key={group.name} className="rounded-xl border border-border bg-card p-4">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">
                {group.name}
              </div>
              <ul className="mt-2 space-y-1 text-sm">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-link hover:underline"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
