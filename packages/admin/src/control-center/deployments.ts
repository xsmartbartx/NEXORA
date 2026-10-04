import { REPOS, githubGet } from "./github";

export interface MergedChange {
  number: number;
  title: string;
  author: string;
  mergedAt: string;
  url: string;
}

export interface LatestRelease {
  tag: string;
  publishedAt: string;
  url: string;
}

export type MainChecks = "success" | "failure" | "pending" | "none";

export interface RepoDeployments {
  repo: string;
  release: LatestRelease | null;
  mainChecks: MainChecks;
  merges: MergedChange[];
}

const MERGES_SHOWN = 8;

/** Merged pull requests into the base branch, newest merge first (the list endpoint sorts by update time, which is not merge time). */
export function parseMergedPulls(body: unknown, limit = MERGES_SHOWN): MergedChange[] {
  if (!Array.isArray(body)) throw new Error("unexpected GitHub response");
  return body
    .map((raw: unknown) => raw as Record<string, unknown>)
    .filter((pr) => typeof pr.merged_at === "string")
    .map((pr) => ({
      number: Number(pr.number),
      title: String(pr.title ?? ""),
      author: String((pr.user as { login?: string } | null)?.login ?? "unknown"),
      mergedAt: String(pr.merged_at),
      url: String(pr.html_url ?? ""),
    }))
    .sort((a, b) => (a.mergedAt < b.mergedAt ? 1 : -1))
    .slice(0, limit);
}

export function parseLatestRelease(body: unknown): LatestRelease | null {
  if (typeof body !== "object" || body === null) return null;
  const release = body as Record<string, unknown>;
  if (typeof release.tag_name !== "string") return null;
  return {
    tag: release.tag_name,
    publishedAt: String(release.published_at ?? release.created_at ?? ""),
    url: String(release.html_url ?? ""),
  };
}

/** One verdict for a commit's check runs: any failure wins, then anything still running, otherwise success. Skipped and neutral runs are not failures. */
export function summarizeCheckRuns(body: unknown): MainChecks {
  const runs =
    typeof body === "object" && body !== null && "check_runs" in body
      ? (body as { check_runs: unknown }).check_runs
      : null;
  if (!Array.isArray(runs)) throw new Error("unexpected GitHub response");
  if (runs.length === 0) return "none";

  let pending = false;
  for (const raw of runs) {
    const run = raw as Record<string, unknown>;
    if (run.status !== "completed") {
      pending = true;
      continue;
    }
    const conclusion = String(run.conclusion ?? "");
    if (
      ["failure", "timed_out", "cancelled", "action_required", "startup_failure"].includes(
        conclusion,
      )
    ) {
      return "failure";
    }
  }
  return pending ? "pending" : "success";
}

/** What is merged and tagged on each repo, and whether `main` is green. This is the source of truth, not the running server: a deploy is a separate manual step. */
export async function collectDeployments(): Promise<RepoDeployments[]> {
  return Promise.all(
    REPOS.map(async (repo) => {
      const [pulls, release, checks] = await Promise.all([
        githubGet(
          `/repos/${repo}/pulls?state=closed&base=main&sort=updated&direction=desc&per_page=30`,
        ),
        githubGet(`/repos/${repo}/releases/latest`),
        githubGet(`/repos/${repo}/commits/main/check-runs?per_page=100`),
      ]);
      if (pulls.status !== 200) throw new Error(`GitHub answered ${pulls.status} for ${repo}`);
      return {
        repo,
        release: release.status === 200 ? parseLatestRelease(release.body) : null,
        mainChecks: checks.status === 200 ? summarizeCheckRuns(checks.body) : "none",
        merges: parseMergedPulls(pulls.body),
      } satisfies RepoDeployments;
    }),
  );
}
