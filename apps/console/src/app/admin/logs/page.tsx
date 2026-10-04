import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@nexora/auth/server";
import {
  LOG_WINDOWS_HOURS,
  collect,
  listPlatformLogs,
  logNamespaceStats,
  parseLogFilters,
  type LogFilters,
} from "@nexora/admin";
import { Badge, cn } from "@nexora/ui";
import { AdminNav } from "../admin-nav";
import { ago } from "../control-center/format";
import { Section, TileBody } from "../control-center/panels";

export const metadata: Metadata = {
  title: "Admin — Logs",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const windowLabel: Record<number, string> = {
  1: "1 hour",
  24: "24 hours",
  168: "7 days",
  720: "30 days",
};

/** The current filters as a query string, with some keys replaced; the cursor never carries over. */
function href(filters: LogFilters, overrides: Record<string, string | undefined> = {}): string {
  const params = new URLSearchParams();
  const base: Record<string, string | undefined> = {
    ns: filters.namespace,
    outcome: filters.outcome,
    org: filters.orgId,
    q: filters.q,
    window: filters.windowHours === 24 ? undefined : String(filters.windowHours),
    ...overrides,
  };
  for (const [key, value] of Object.entries(base)) if (value) params.set(key, value);
  const query = params.toString();
  return query ? `/admin/logs?${query}` : "/admin/logs";
}

function utc(date: Date): string {
  return date.toISOString().replace("T", " ").slice(0, 19);
}

export default async function LogsPage(props: PageProps<"/admin/logs">) {
  await requireAdmin();
  const filters = parseLogFilters(await props.searchParams);
  const [page, stats] = await Promise.all([
    collect(() => listPlatformLogs(filters)),
    collect(() => logNamespaceStats(filters)),
  ]);

  const filtered = Boolean(filters.namespace || filters.outcome || filters.orgId || filters.q);

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <span className="font-mono text-xs uppercase tracking-widest text-warning">NEXORA Staff</span>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Logs</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        The platform-wide audit log across every organisation: API key changes, product usage, staff
        actions and failures. Times are UTC. Container and web-server logs are not collected
        centrally yet, so they are not shown here.
      </p>
      <AdminNav current="/admin/logs" />

      <Section title="Filter">
        <form method="get" action="/admin/logs" className="flex flex-wrap items-end gap-3 text-sm">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Action contains</span>
            <input
              name="q"
              defaultValue={filters.q ?? ""}
              maxLength={80}
              placeholder="scan.completed"
              className="rounded-lg border border-border bg-card px-3 py-1.5"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Organisation id</span>
            <input
              name="org"
              defaultValue={filters.orgId ?? ""}
              placeholder="org_…"
              className="rounded-lg border border-border bg-card px-3 py-1.5 font-mono"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Outcome</span>
            <select
              name="outcome"
              defaultValue={filters.outcome ?? ""}
              className="rounded-lg border border-border bg-card px-3 py-1.5"
            >
              <option value="">Any</option>
              <option value="success">Success</option>
              <option value="failure">Failure</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Window</span>
            <select
              name="window"
              defaultValue={String(filters.windowHours)}
              className="rounded-lg border border-border bg-card px-3 py-1.5"
            >
              {LOG_WINDOWS_HOURS.map((hours) => (
                <option key={hours} value={hours}>
                  Last {windowLabel[hours]}
                </option>
              ))}
            </select>
          </label>
          {filters.namespace ? <input type="hidden" name="ns" value={filters.namespace} /> : null}
          <button
            type="submit"
            className="rounded-lg bg-primary px-4 py-1.5 font-medium text-primary-foreground"
          >
            Apply
          </button>
          {filtered ? (
            <Link href="/admin/logs" className="py-1.5 text-muted-foreground hover:text-foreground">
              Clear
            </Link>
          ) : null}
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          <TileBody tile={stats} label="Event counts">
            {(namespaces) => (
              <>
                <Link
                  href={href(filters, { ns: undefined })}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs",
                    !filters.namespace
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  All · {namespaces.reduce((sum, n) => sum + n.total, 0)}
                </Link>
                {namespaces.map((n) => (
                  <Link
                    key={n.namespace}
                    href={href(filters, { ns: n.namespace })}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs",
                      filters.namespace === n.namespace
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {n.namespace} · {n.total}
                    {n.failures > 0 ? (
                      <span className="ml-1 text-destructive">({n.failures} failed)</span>
                    ) : null}
                  </Link>
                ))}
              </>
            )}
          </TileBody>
        </div>
      </Section>

      <Section title={`Events · last ${windowLabel[filters.windowHours]}`}>
        <TileBody tile={page} label="Audit log">
          {({ rows, nextCursor }) =>
            rows.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                No events match these filters in this window.
              </p>
            ) : (
              <>
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-border text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">Time (UTC)</th>
                        <th className="px-3 py-2 font-medium">Action</th>
                        <th className="px-3 py-2 font-medium">Outcome</th>
                        <th className="px-3 py-2 font-medium">Organisation</th>
                        <th className="px-3 py-2 font-medium">Resource</th>
                        <th className="px-3 py-2 font-medium">Detail</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {rows.map((row) => (
                        <tr key={row.id} className="align-top">
                          <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">
                            <time dateTime={row.createdAt.toISOString()} title={ago(row.createdAt)}>
                              {utc(row.createdAt)}
                            </time>
                          </td>
                          <td className="px-3 py-2 font-mono text-xs">{row.action}</td>
                          <td className="px-3 py-2">
                            <Badge variant={row.outcome === "success" ? "success" : "warning"}>
                              {row.outcome}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 font-mono text-xs">
                            {row.orgId ? (
                              <Link
                                href={`/admin/${row.orgId}`}
                                className="text-link hover:underline"
                              >
                                {row.orgId.slice(0, 14)}…
                              </Link>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">
                            {row.resourceType ?? "—"}
                            {row.resourceId ? ` · ${row.resourceId.slice(0, 12)}` : ""}
                          </td>
                          <td className="max-w-xs break-all px-3 py-2 font-mono text-xs text-muted-foreground">
                            {row.detail ?? ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Showing {rows.length} newest matching events.</span>
                  {nextCursor ? (
                    <Link
                      href={`${href(filters)}${href(filters).includes("?") ? "&" : "?"}cursor=${encodeURIComponent(nextCursor)}`}
                      className="text-link hover:underline"
                    >
                      Older events →
                    </Link>
                  ) : (
                    <span>End of results.</span>
                  )}
                </div>
              </>
            )
          }
        </TileBody>
      </Section>
    </div>
  );
}
