#!/usr/bin/env node
// CostSec runner: reads the repository's configuration through the GitHub API (read-only),
// judges it with policy.mjs and keeps one tracking issue up to date. Runs in Actions with
// COSTSEC_TOKEN (fine-grained, read-only) when set, else the workflow's GITHUB_TOKEN, which
// cannot see protection or security settings; those then show up as UNVERIFIED, not as passes.
// The only write is the issue, and only when GITHUB_TOKEN may write issues.

import { evaluate, isClean, MARKER, mergeProtection, renderReport } from "./policy.mjs";

import { readdirSync, readFileSync } from "node:fs";

const API = "https://api.github.com";
// This audit is for one repository. The environment may only confirm it, never choose it,
// so no request path is built from environment input.
const REPO = "xsmartbartx/NEXORA";
const validRepo = process.env.GITHUB_REPOSITORY === REPO;
const repo = REPO;
const readToken = process.env.COSTSEC_TOKEN || process.env.GITHUB_TOKEN || "";
const issueToken = process.env.GITHUB_TOKEN || "";
const TITLE = "CostSec: configuration audit";

const SAFE_PATH = /^\/repos\/xsmartbartx\/NEXORA(?:\/[\w./?=&%-]*)?$/;

async function call(token, path, init = {}) {
  if (!SAFE_PATH.test(path) || path.includes(".."))
    throw new Error("refusing an unexpected API path");
  const res = await fetch(`${API}${path}`, {
    ...init,
    redirect: "error",
    headers: {
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  return { status: res.status, body, link: res.headers.get("link") ?? "" };
}

/** The body, or null when the token may not read it. */
async function read(path) {
  const { status, body } = await call(readToken, path);
  return status === 200 ? body : null;
}

const MAX_PAGES = 10;

/** The path of the `rel="next"` link, or null. Cursor-paged endpoints (Dependabot) need this. */
function nextPath(link) {
  const part = link
    .split(",")
    .map((p) => p.trim())
    .find((p) => p.endsWith('rel="next"'));
  if (!part) return null;
  const url = part.slice(part.indexOf("<") + 1, part.indexOf(">"));
  return url.startsWith(`${API}/`) ? url.slice(API.length) : null;
}

/** Every page of a list endpoint, or null if any page could not be read (never a partial list). */
async function readAll(token, path) {
  const first = `${path}${path.includes("?") ? "&" : "?"}per_page=100`;
  const all = [];
  let next = first;
  for (let page = 0; page < MAX_PAGES && next; page += 1) {
    // Pages are sequential on purpose: each one names the next.
    const { status, body, link } = await call(token, next); // NOSONAR
    if (status !== 200 || !Array.isArray(body)) return null;
    all.push(...body);
    next = nextPath(link);
  }
  return next ? null : all;
}

async function count(path) {
  const list = await readAll(readToken, `${path}?state=open`);
  if (list === null) return null;
  return list.filter((a) => {
    const sev =
      a.security_advisory?.severity ?? a.rule?.security_severity_level ?? a.rule?.severity;
    return sev === "high" || sev === "critical";
  }).length;
}

async function collect() {
  const info = await read(`/repos/${repo}`);
  // Fixed, like the repository: no path segment comes from a response.
  const defaultBranch = "main";
  const branch = await read(`/repos/${repo}/branches/${defaultBranch}`);
  const detail = await read(`/repos/${repo}/branches/${defaultBranch}/protection`);
  const actionsPerms = await read(`/repos/${repo}/actions/permissions/workflow`);
  // Workflows are read from the checkout the job already has, not fetched by name.
  const dir = ".github/workflows";
  let workflows = null;
  try {
    workflows = readdirSync(dir)
      .filter((name) => /\.ya?ml$/.test(name))
      .map((name) => ({ path: `${dir}/${name}`, content: readFileSync(`${dir}/${name}`, "utf8") }));
  } catch {
    // Left null: reported as UNVERIFIED-WORKFLOWS rather than treated as "no workflows".
  }

  const rules = await read(`/repos/${repo}/rules/branches/${defaultBranch}`);
  const protection = mergeProtection(branch, detail, rules);

  return {
    defaultBranch,
    securityAndAnalysis: info?.security_and_analysis ?? null,
    protection,
    workflowDefaultPermissions: actionsPerms?.default_workflow_permissions ?? null,
    workflows,
    alerts: {
      dependabotHigh: await count(`/repos/${repo}/dependabot/alerts`),
      codeScanningHigh: await count(`/repos/${repo}/code-scanning/alerts`),
    },
  };
}

const BOT = "github-actions[bot]";

/** Only the bot's own tracking issue counts, so a user-made issue can never be edited or closed. */
const isTracker = (i) =>
  i.user?.login === BOT && i.title === TITLE && !i.pull_request && i.body?.includes(MARKER);

async function patch(number, fields) {
  const res = await call(issueToken, `/repos/${repo}/issues/${number}`, {
    method: "PATCH",
    body: JSON.stringify(fields),
  });
  if (res.status !== 200) throw new Error("could not update the tracking issue");
}

async function upsertIssue(findings, body) {
  const issues = await readAll(issueToken, "/repos/" + repo + "/issues?state=open");
  if (issues === null) throw new Error("could not list issues");
  const existing = issues.find(isTracker);
  const number = Number.parseInt(existing?.number, 10);
  if (existing && isClean(findings)) {
    await patch(number, { state: "closed", body });
    return "closed";
  }
  if (existing) {
    await patch(number, { body });
    return "updated";
  }
  if (isClean(findings)) return "clean, no issue";
  const made = await call(issueToken, `/repos/${repo}/issues`, {
    method: "POST",
    body: JSON.stringify({ title: TITLE, body }),
  });
  if (made.status !== 201) throw new Error("could not open the tracking issue");
  return "opened";
}

if (!validRepo) {
  console.error(`GITHUB_REPOSITORY must be ${REPO}`);
  process.exit(2);
}
const findings = evaluate(await collect());
const body = renderReport(findings, new Date().toISOString().slice(0, 10));
// Counts only; rule ids and evidence go to the issue, not the log.
console.log(`CostSec: ${findings.length} finding(s)`);
console.log(
  process.env.COSTSEC_DRY_RUN === "1"
    ? "\nissue: dry run, nothing written"
    : `\nissue: ${await upsertIssue(findings, body)}`,
);
