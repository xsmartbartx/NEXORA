import type { Metadata } from "next";
import { requireOrg } from "@nexora/auth/server";
import { getGrowthAnalytics, getGrowthAttributionReport } from "../actions";

export const metadata: Metadata = {
  title: "Growth analytics",
};

function countFor(rows: { status: string; count: number }[], status: string) {
  return rows.find((row) => row.status === status)?.count ?? 0;
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
      <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
    </section>
  );
}

export default async function GrowthAnalyticsPage() {
  await requireOrg();
  const [data, attribution] = await Promise.all([getGrowthAnalytics(), getGrowthAttributionReport()]);
  const activeCampaigns = countFor(data.campaigns.byStatus, "active");
  const pendingApprovals = data.approvals.pending;
  const maxDaily = Math.max(1, ...data.aiDraftsByDay.map((point) => point.count));

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <p className="text-sm font-medium text-link">Growth Engine</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Operational analytics</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        Organisation-scoped operational activity from NEXORA records and audit events. This view
        does not estimate revenue, CAC or conversions. Lead source reporting below is based only on recorded touchpoints.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Campaigns" value={data.campaigns.total} detail={`${activeCampaigns} active`} />
        <Metric label="Content items" value={data.content.total} detail={`${countFor(data.content.byStatus, "approved")} approved`} />
        <Metric label="Pending approvals" value={pendingApprovals} detail="Awaiting review" />
        <Metric label="AI drafts · 30 days" value={data.aiDraftsLast30Days} detail="Generated through NEXORA Gateway" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="font-semibold">Campaign status</h2>
          {data.campaigns.byStatus.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No campaign records yet.</p>
          ) : (
            <div className="mt-4 grid gap-3">
              {data.campaigns.byStatus.map((row) => (
                <div key={row.status} className="flex items-center justify-between text-sm">
                  <span className="capitalize text-muted-foreground">{row.status}</span>
                  <span className="font-medium tabular-nums">{row.count}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="font-semibold">Content status</h2>
          {data.content.byStatus.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No content records yet.</p>
          ) : (
            <div className="mt-4 grid gap-3">
              {data.content.byStatus.map((row) => (
                <div key={row.status} className="flex items-center justify-between text-sm">
                  <span className="capitalize text-muted-foreground">{row.status.replace("_", " ")}</span>
                  <span className="font-medium tabular-nums">{row.count}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="mt-8 rounded-xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">AI draft generation · last 30 days</h2>
          <span className="text-xs text-muted-foreground">
            Since {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(data.periodStart))}
          </span>
        </div>
        {data.aiDraftsByDay.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No AI draft generation events in this period.</p>
        ) : (
          <div className="mt-5 flex h-36 items-end gap-1">
            {data.aiDraftsByDay.map((point) => (
              <div
                key={point.day}
                className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1"
                title={`${point.day}: ${point.count} drafts`}
              >
                <span className="text-[10px] text-muted-foreground">{point.count}</span>
                <div
                  className="w-full rounded-t-sm bg-primary/70"
                  style={{ height: `${Math.max(4, (point.count / maxDaily) * 100)}px` }}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8 rounded-xl border border-border bg-card p-6">
        <h2 className="font-semibold">Lead attribution · first touch vs last touch</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Each lead is counted once per model using its earliest or latest recorded touchpoint.
          Missing source or medium values are grouped as unknown. These are lead counts, not revenue attribution.
        </p>
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          {([{ key: "firstTouch", label: "First touch" }, { key: "lastTouch", label: "Last touch" }] as const).map((model) => {
            const rows = attribution[model.key];
            return (
              <div key={model.key}>
                <h3 className="text-sm font-medium">{model.label}</h3>
                {rows.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">No touchpoints recorded.</p>
                ) : (
                  <div className="mt-3 grid gap-2">
                    {rows.map((row) => (
                      <div key={row.source + row.medium} className="flex items-center justify-between gap-3 border-b border-border pb-2 text-sm">
                        <span><span className="block font-medium">{row.source}</span><span className="text-xs text-muted-foreground">{row.medium}</span></span>
                        <span className="font-medium tabular-nums">{row.leads}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
      <section className="mt-8 rounded-xl border border-dashed border-border p-6">
        <h2 className="font-semibold">Business outcome metrics unavailable</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Revenue attribution, CAC, conversion rate, activation and retention are intentionally
          omitted until billing, CRM and product analytics sources are mapped to campaign
          identifiers. Operational record counts must not be interpreted as marketing performance.
        </p>
      </section>
    </div>
  );
}
