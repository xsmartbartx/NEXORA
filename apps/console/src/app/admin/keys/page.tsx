import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@nexora/auth/server";
import { STALE_AFTER_DAYS, collect, collectKeyHygiene, collectQuotaPressure } from "@nexora/admin";
import { AdminNav } from "../admin-nav";
import { Section, Stat, TileBody } from "../control-center/panels";

export const metadata: Metadata = {
  title: "Admin — Keys & quotas",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function KeysAndQuotasPage() {
  await requireAdmin();
  const [hygiene, pressure] = await Promise.all([
    collect(collectKeyHygiene),
    collect(collectQuotaPressure, 20_000),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <span className="font-mono text-xs uppercase tracking-widest text-warning">NEXORA Staff</span>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Keys &amp; quotas</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        API-key hygiene across every organisation, and the customers closest to their plan limits.
        Key secrets are never shown here: only counts, since only a hash of each key is stored.
      </p>
      <AdminNav current="/admin/keys" />

      <Section title="API keys">
        <TileBody tile={hygiene} label="API keys">
          {(keys) => (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Stat label="Active keys" value={keys.active}>
                  across {keys.organisations} organisation{keys.organisations === 1 ? "" : "s"}
                </Stat>
                <Stat
                  label="Never used"
                  value={keys.neverUsed}
                  tone={keys.neverUsed > 0 ? "warn" : "good"}
                >
                  created over a week ago, no calls yet
                </Stat>
                <Stat label="Stale" value={keys.stale} tone={keys.stale > 0 ? "warn" : "good"}>
                  unused for {STALE_AFTER_DAYS}+ days: candidates to revoke
                </Stat>
                <Stat label="Revoked (30 days)" value={keys.revokedLast30Days}>
                  keys customers retired
                </Stat>
              </div>
              {keys.topOrgs.length > 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  Most keys:{" "}
                  {keys.topOrgs.map((org, index) => (
                    <span key={org.orgId}>
                      {index > 0 ? ", " : ""}
                      <Link href={`/admin/${org.orgId}`} className="text-link hover:underline">
                        {org.orgId.slice(0, 14)}…
                      </Link>{" "}
                      ({org.active})
                    </span>
                  ))}
                </p>
              ) : null}
            </>
          )}
        </TileBody>
      </Section>

      <Section
        title="Quota pressure"
        description="Customers at 80% or more of a plan limit this period, fullest first: the ones about to hit a wall, and the natural upgrade conversations."
      >
        <TileBody tile={pressure} label="Quota pressure">
          {(rows) =>
            rows.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                Nobody is near a plan limit right now.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Organisation</th>
                      <th className="px-3 py-2 font-medium">Product</th>
                      <th className="px-3 py-2 font-medium">Plan</th>
                      <th className="px-3 py-2 text-right font-medium">Used</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rows.map((row) => (
                      <tr key={`${row.orgId}-${row.product}`}>
                        <td className="px-3 py-2">
                          <Link href={`/admin/${row.orgId}`} className="text-link hover:underline">
                            {row.orgName}
                          </Link>
                        </td>
                        <td className="px-3 py-2">{row.product}</td>
                        <td className="px-3 py-2">{row.plan}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">
                          <span className={row.ratio >= 1 ? "text-destructive" : "text-warning"}>
                            {row.used.toLocaleString("en-US")} / {row.limit.toLocaleString("en-US")}{" "}
                            ({Math.round(row.ratio * 100)}%)
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          }
        </TileBody>
      </Section>
    </div>
  );
}
