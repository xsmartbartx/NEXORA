import type { Metadata } from "next";
import { requireAdmin } from "@nexora/auth/server";
import { collect, collectDeployments, type MainChecks } from "@nexora/admin";
import { AdminNav } from "../admin-nav";
import { ago } from "../control-center/format";
import { Dot, Section, TileBody, type Tone } from "../control-center/panels";

export const metadata: Metadata = {
  title: "Admin — Deployments",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const checksTone: Record<MainChecks, Tone> = {
  success: "good",
  failure: "bad",
  pending: "warn",
  none: "neutral",
};

const checksLabel: Record<MainChecks, string> = {
  success: "main is green",
  failure: "main has failing checks",
  pending: "checks running on main",
  none: "no checks reported",
};

export default async function DeploymentsPage() {
  await requireAdmin();
  const deployments = await collect(collectDeployments, 20_000);

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <span className="font-mono text-xs uppercase tracking-widest text-warning">NEXORA Staff</span>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Deployments</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        What has been merged and released on each repository, and whether its main branch is green.
        This is the state of the code, not of the server: a deploy to production is a separate
        manual step, so a merge here is not necessarily live yet.
      </p>
      <AdminNav current="/admin/deployments" />

      <TileBody tile={deployments} label="Deployments">
        {(repos) => (
          <>
            {repos.map((repo) => (
              <Section key={repo.repo} title={repo.repo}>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
                  <span className="flex items-center gap-2">
                    <Dot tone={checksTone[repo.mainChecks]} label={repo.mainChecks} />
                    {checksLabel[repo.mainChecks]}
                  </span>
                  <span className="text-muted-foreground">
                    {repo.release ? (
                      <>
                        latest release{" "}
                        <a href={repo.release.url} className="text-link hover:underline">
                          {repo.release.tag}
                        </a>{" "}
                        · {ago(repo.release.publishedAt)}
                      </>
                    ) : (
                      "no release published"
                    )}
                  </span>
                </div>

                <ul className="mt-3 divide-y divide-border rounded-xl border border-border">
                  {repo.merges.length === 0 ? (
                    <li className="p-4 text-sm text-muted-foreground">No merged pull requests.</li>
                  ) : (
                    repo.merges.map((merge) => (
                      <li
                        key={merge.number}
                        className="flex flex-wrap items-baseline justify-between gap-2 p-3 text-sm"
                      >
                        <a href={merge.url} className="text-link hover:underline">
                          #{merge.number} {merge.title}
                        </a>
                        <span className="text-xs text-muted-foreground">
                          {merge.author} · merged {ago(merge.mergedAt)}
                        </span>
                      </li>
                    ))
                  )}
                </ul>
              </Section>
            ))}
          </>
        )}
      </TileBody>
    </div>
  );
}
