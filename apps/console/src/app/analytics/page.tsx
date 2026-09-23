import type { Metadata } from "next";
import { requireOrg } from "@nexora/auth/server";
import { getOrgPlan } from "@nexora/billing";
import { getAllProducts } from "@nexora/registry";
import { countOrgEvents, countOrgEventsByDay, startOfCurrentBillingPeriod } from "@nexora/telemetry";
import { zeroFillDailySeries, type DayPoint } from "./series";

export const metadata: Metadata = {
  title: "Analytics",
};

const SERIES_DAYS = 14;

interface ProductAnalytics {
  productName: string;
  feature: string;
  limit: number | null;
  usedThisPeriod: number;
  series: DayPoint[];
}

// Data fetching is kept out of any JSX — see the same note on the Billing
// page (react-hooks/error-boundaries: a try/catch around JSX construction
// doesn't actually protect rendering, since React doesn't render synchronously).
async function loadAnalyticsData(orgId: string): Promise<ProductAnalytics[] | null> {
  try {
    const plan = await getOrgPlan(orgId);
    const products = getAllProducts();
    const periodStart = startOfCurrentBillingPeriod();
    const since = new Date(Date.now() - SERIES_DAYS * 24 * 60 * 60 * 1000);

    return await Promise.all(
      Object.entries(plan.limits).map(async ([feature, limit]) => {
        const product = products.find((p) => feature.startsWith(`${p.slug}.`));
        const action = `${feature}.completed`;
        const [usedThisPeriod, dailyRows] = await Promise.all([
          countOrgEvents(orgId, action, periodStart),
          countOrgEventsByDay(orgId, action, since),
        ]);
        return {
          productName: product?.short_name ?? feature.split(".")[0],
          feature,
          limit,
          usedThisPeriod,
          series: zeroFillDailySeries(dailyRows, SERIES_DAYS),
        };
      }),
    );
  } catch {
    return null;
  }
}

export default async function AnalyticsPage() {
  const { orgId } = await requireOrg();
  const data = await loadAnalyticsData(orgId);

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        Console
      </span>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Analytics</h1>
      <p className="mt-2 max-w-xl text-muted-foreground">
        Usage per product, over the last {SERIES_DAYS} days and the current billing period — the
        same events Billing meters against (§4.2 C-EVENT), broken down instead of summed.
      </p>

      <div className="mt-8">
        {data === null ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            Database not reachable. Set DATABASE_URL to a real Postgres instance to see analytics.
          </div>
        ) : data.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            Nothing meterable on your current plan yet.
          </div>
        ) : (
          <AnalyticsContent entries={data} />
        )}
      </div>
    </div>
  );
}

function AnalyticsContent({ entries }: { entries: ProductAnalytics[] }) {
  return (
    <div className="flex flex-col gap-6">
      {entries.map((entry) => (
        <div key={entry.feature} className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium">{entry.productName}</p>
              <p className="font-mono text-xs text-muted-foreground">{entry.feature}</p>
            </div>
            <p className="shrink-0 text-sm text-muted-foreground">
              {entry.usedThisPeriod}
              {entry.limit === null ? "" : ` / ${entry.limit}`} this period
            </p>
          </div>
          <DailyBars series={entry.series} />
        </div>
      ))}
    </div>
  );
}

function DailyBars({ series }: { series: DayPoint[] }) {
  const max = Math.max(1, ...series.map((point) => point.count));
  return (
    <div className="mt-4 flex h-16 items-end gap-1">
      {series.map((point) => (
        <div
          key={point.day}
          title={`${point.day}: ${point.count}`}
          className="flex-1 rounded-sm bg-primary/70"
          style={{ height: `${Math.max(4, (point.count / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}
