import { timedFetch } from "./result";

export const REPOS = ["xsmartbartx/NEXORA", "xsmartbartx/Vigilo", "xsmartbartx/NeuraWall"] as const;

const CACHE_MS = 5 * 60_000;
const cache = new Map<string, { at: number; value: GithubResponse }>();

export interface GithubResponse {
  status: number;
  body: unknown;
}

export function hasGithubToken(): boolean {
  return Boolean(process.env.GITHUB_TOKEN);
}

/**
 * GET against the GitHub REST API. Cached for five minutes: unauthenticated
 * calls are limited to 60/hour per IP, and the dashboard auto-refreshes.
 * A non-2xx answer is returned, not thrown — callers decide whether a 404
 * (feature disabled on that repo) is fatal.
 */
export async function githubGet(path: string, now: number = Date.now()): Promise<GithubResponse> {
  const key = `${hasGithubToken()}:${path}`;
  const hit = cache.get(key);
  if (hit && now - hit.at < CACHE_MS) return hit.value;

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "nexora-control-center",
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  const response = await timedFetch(`https://api.github.com${path}`, { headers });
  if (
    response.status === 429 ||
    (response.status === 403 && response.headers.get("x-ratelimit-remaining") === "0")
  ) {
    throw new Error("GitHub rate limit reached");
  }
  const value = { status: response.status, body: await response.json().catch(() => null) };
  if (response.ok) cache.set(key, { at: now, value });
  return value;
}

/** Test-only. */
export function resetGithubCache() {
  cache.clear();
}
