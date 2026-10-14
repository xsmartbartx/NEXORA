#!/usr/bin/env node
// CostSec runner: reads the repository's configuration through the GitHub API (read-only),
// judges it with policy.mjs and keeps one tracking issue up to date. Runs in Actions with
// COSTSEC_TOKEN (fine-grained, read-only) when set, else the workflow's GITHUB_TOKEN, which
// cannot see protection or security settings; those then show up as UNVERIFIED, not as passes.
// The only write is the issue, and only when GITHUB_TOKEN may write issues.

import { evaluate, isClean, MARKER, renderReport } from "./policy.mjs";

const API = "https://api.github.com";
// This audit is for one repository. The environment may only confirm it, never choose it,
// so no request path is built from environment input.
const REPO = "xsmartbartx/NEXORA";
const validRepo = process.env.GITHUB_REPOSITORY === REPO;
const repo = REPO;
const readToken = process.env.COSTSEC_TOKEN || process.env.GITHUB_TOKEN || "";
const issueToken = process.env.GITHUB_TOKEN || "";
const TITLE = "CostSec: configuration audit";

async function call(token, path, init = {}) {
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
  return { status: res.status, body };
}

/** The body, or null when the token may not read it. */
async function read(path) {
  const { status, body } = await call(readToken, path);
  return status === 200 ? body : null;
}

async function count(path) {
  const body = await read(`${path}?state=open&per_page=100`);
  if (!Array.isArray(body)) return null;
  return body.filter((a) => {
    const sev =
      a.security_advisory?.severity ?? a.rule?.security_severity_level ?? a.rule?.severity;
    return sev === "high" || sev === "critical";
  }).length;
}

async function collect() {
  const info = await read(`/repos/${repo}`);
  const defaultBranch = info?.default_branch ?? "main";
  const branch = await read(`/repos/${repo}/branches/${defaultBranch}`);
  const detail = await read(`/repos/${repo}/branches/${defaultBranch}/protection`);
  const actionsPerms = await read(`/repos/${repo}/actions/permissions/workflow`);
  const list = await read(`/repos/${repo}/contents/.github/workflows`);

  const files = (Array.isArray(list) ? list : []).filter((f) => /\.ya?ml$/.test(f.name));
  const fetched = await Promise.all(
    files.map(async (file) => ({
      file,
      body: await read(
        `/repos/${repo}/contents/${encodeURIComponent(file.path).replaceAll("%2F", "/")}`,
      ),
    })),
  );
  const workflows = fetched
    .filter(({ body }) => body?.content)
    .map(({ file, body }) => ({
      path: file.path,
      content: Buffer.from(body.content, "base64").toString("utf8"),
    }));

  const protection =
    branch === null
      ? null
      : {
          protected: branch.protected === true,
          requiredChecks: branch.protection?.required_status_checks?.contexts ?? [],
          enforceAdmins: detail ? detail.enforce_admins?.enabled === true : null,
          allowForcePushes: detail ? detail.allow_force_pushes?.enabled === true : null,
          allowDeletions: detail ? detail.allow_deletions?.enabled === true : null,
        };

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

async function upsertIssue(findings, body) {
  const open = await call(issueToken, `/repos/${repo}/issues?state=open&per_page=100`);
  const existing = Array.isArray(open.body)
    ? open.body.find((i) => i.body?.includes(MARKER))
    : undefined;
  if (existing && isClean(findings)) {
    await call(issueToken, `/repos/${repo}/issues/${existing.number}`, {
      method: "PATCH",
      body: JSON.stringify({ state: "closed", body }),
    });
    return `closed #${existing.number}`;
  }
  if (existing) {
    await call(issueToken, `/repos/${repo}/issues/${existing.number}`, {
      method: "PATCH",
      body: JSON.stringify({ body }),
    });
    return `updated #${existing.number}`;
  }
  if (isClean(findings)) return "clean, no issue";
  const made = await call(issueToken, `/repos/${repo}/issues`, {
    method: "POST",
    body: JSON.stringify({ title: TITLE, body }),
  });
  return made.status === 201
    ? `opened #${made.body.number}`
    : `could not open an issue (HTTP ${made.status})`;
}

if (!validRepo) {
  console.error(`GITHUB_REPOSITORY must be ${REPO}`);
  process.exit(2);
}
const findings = evaluate(await collect());
const body = renderReport(findings, new Date().toISOString().slice(0, 10));
// Log only fixed rule ids and counts; the full report goes to the issue, not the log.
console.log(
  `CostSec: ${findings.length} finding(s): ${findings.map((f) => f.id).join(", ") || "none"}`,
);
console.log(
  process.env.COSTSEC_DRY_RUN === "1"
    ? "\nissue: dry run, nothing written"
    : `\nissue: ${await upsertIssue(findings, body)}`,
);
