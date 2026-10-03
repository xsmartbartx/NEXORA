import type { EndpointResult } from "./health";
import { REPOS, githubGet } from "./github";
import { NotConnected, timedFetch } from "./result";

export interface LatencySummary {
  sampled: number;
  averageMs: number | null;
  slowest: { name: string; latencyMs: number }[];
}

/** Latency of the endpoints that answered — a down endpoint has no latency, and shows up in health instead. */
export function summarizeLatency(results: EndpointResult[]): LatencySummary {
  const answered = results.filter(
    (r): r is EndpointResult & { latencyMs: number } => r.latencyMs !== null,
  );
  if (answered.length === 0) return { sampled: 0, averageMs: null, slowest: [] };

  const total = answered.reduce((sum, r) => sum + r.latencyMs, 0);
  return {
    sampled: answered.length,
    averageMs: Math.round(total / answered.length),
    slowest: [...answered]
      .sort((a, b) => b.latencyMs - a.latencyMs)
      .slice(0, 3)
      .map((r) => ({ name: r.name, latencyMs: r.latencyMs })),
  };
}

export interface SentryIssue {
  id: string;
  title: string;
  level: string;
  /** Events in the window. */
  count: number;
  permalink: string;
}

export interface SentrySummary {
  unresolved: number;
  /** True when Sentry returned a full page, so the real number is at least this. */
  capped: boolean;
  top: SentryIssue[];
}

const SENTRY_PAGE = 100;

export function parseSentryIssues(body: unknown): SentrySummary {
  if (!Array.isArray(body)) throw new Error("unexpected Sentry response");

  const issues: SentryIssue[] = body.map((raw: unknown) => {
    const issue = raw as Record<string, unknown>;
    return {
      id: String(issue.id ?? ""),
      title: String(issue.title ?? "(untitled)"),
      level: String(issue.level ?? "error"),
      count: Number(issue.count ?? 0) || 0,
      permalink: String(issue.permalink ?? ""),
    };
  });

  return {
    unresolved: issues.length,
    capped: issues.length >= SENTRY_PAGE,
    top: [...issues].sort((a, b) => b.count - a.count).slice(0, 5),
  };
}

/** Unresolved issues that saw an event in the last 24 hours. */
export async function collectSentry(): Promise<SentrySummary> {
  const token = process.env.SENTRY_AUTH_TOKEN;
  const org = process.env.SENTRY_ORG;
  if (!token || !org) {
    throw new NotConnected(
      "Sentry",
      "Set SENTRY_AUTH_TOKEN (an auth token with org:read and event:read) and SENTRY_ORG (the organisation slug). SENTRY_API_BASE overrides https://sentry.io for EU/regional hosts.",
    );
  }

  // `||`, not `??`: compose passes an unset optional var as an empty string.
  const base = process.env.SENTRY_API_BASE || "https://sentry.io";
  const query = new URLSearchParams({
    statsPeriod: "24h",
    query: "is:unresolved",
    limit: String(SENTRY_PAGE),
  });
  const response = await timedFetch(
    `${base}/api/0/organizations/${encodeURIComponent(org)}/issues/?${query}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!response.ok) throw new Error(`Sentry answered ${response.status}`);
  return parseSentryIssues(await response.json());
}

export interface WorkflowStatus {
  name: string;
  /** `success`, `failure`, ... — null while a run is still in progress. */
  conclusion: string | null;
  status: string;
  url: string;
  updatedAt: string;
  commit: string;
}

export interface RepoCi {
  repo: string;
  workflows: WorkflowStatus[];
}

/**
 * Display names are not identities: the same CodeQL workflow's runs are
 * titled "CodeQL" or "Push on main" depending on how they started, so
 * runs are grouped by workflow id. Dependabot's dependency-graph updates
 * are bookkeeping, not CI, and would otherwise bury the real workflows.
 */
function workflowLabel(run: Record<string, unknown>): string {
  const path = String(run.path ?? "");
  if (path.startsWith("dynamic/github-code-scanning/codeql")) return "CodeQL";
  return String(run.name ?? "workflow");
}

/** Newest run of each workflow, from a newest-first run list. */
export function latestRunPerWorkflow(body: unknown): WorkflowStatus[] {
  const runs =
    typeof body === "object" && body !== null && "workflow_runs" in body
      ? (body as { workflow_runs: unknown }).workflow_runs
      : null;
  if (!Array.isArray(runs)) throw new Error("unexpected GitHub response");

  const seen = new Map<string, WorkflowStatus>();
  for (const raw of runs) {
    const run = raw as Record<string, unknown>;
    if (String(run.path ?? "").startsWith("dynamic/dependabot/")) continue;

    const key = String(run.workflow_id ?? run.name ?? "workflow");
    if (seen.has(key)) continue;
    seen.set(key, {
      name: workflowLabel(run),
      conclusion: typeof run.conclusion === "string" ? run.conclusion : null,
      status: String(run.status ?? ""),
      url: String(run.html_url ?? ""),
      updatedAt: String(run.updated_at ?? ""),
      commit: String(
        (run.head_commit as { message?: string } | null)?.message?.split("\n")[0] ?? "",
      ),
    });
  }
  return [...seen.values()];
}

/** Latest CI/CodeQL/uptime result on `main` for each repo. Public repos, so it works without a token. */
export async function collectCi(): Promise<RepoCi[]> {
  return Promise.all(
    REPOS.map(async (repo) => {
      const { status, body } = await githubGet(
        `/repos/${repo}/actions/runs?branch=main&per_page=30`,
      );
      if (status !== 200) throw new Error(`GitHub answered ${status} for ${repo}`);
      return { repo, workflows: latestRunPerWorkflow(body) };
    }),
  );
}
