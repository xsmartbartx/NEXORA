// CostSec policy-as-code: pure rules over a snapshot of the repository's configuration.
// No network, no secrets, no side effects: `collect.mjs` builds the snapshot, this file
// only judges it. A `null` field means "could not be read with the token in use"; that is
// reported as UNVERIFIED rather than guessed either way.

const ORDER = { high: 0, medium: 1, low: 2, info: 3 };

const finding = (id, severity, title, evidence, suggestion) => ({
  id,
  severity,
  title,
  evidence,
  suggestion,
});

function branchRules(snapshot) {
  const p = snapshot.protection;
  if (p === null || p === undefined) {
    return [
      finding(
        "UNVERIFIED-BRANCH",
        "info",
        "Branch protection could not be read",
        "The token has no access to the protection settings.",
        "Provide COSTSEC_TOKEN (fine-grained, read-only) to verify it.",
      ),
    ];
  }
  if (!p.protected) {
    return [
      finding(
        "BRANCH-PROTECTED",
        "high",
        "The default branch is not protected",
        `${snapshot.defaultBranch} accepts direct pushes.`,
        "Enable branch protection with required status checks.",
      ),
    ];
  }
  const out = [];
  if (!p.requiredChecks || p.requiredChecks.length === 0) {
    out.push(
      finding(
        "BRANCH-CHECKS",
        "medium",
        "No required status checks on the default branch",
        "Merging does not wait for CI.",
        "Require the CI build as a status check.",
      ),
    );
  }
  if (p.allowForcePushes === true) {
    out.push(
      finding(
        "BRANCH-FORCE",
        "high",
        "Force pushes are allowed on the default branch",
        "History can be rewritten.",
        "Disable force pushes.",
      ),
    );
  }
  if (p.allowDeletions === true) {
    out.push(
      finding(
        "BRANCH-DELETE",
        "high",
        "The default branch can be deleted",
        "Deletions are allowed.",
        "Disable branch deletion.",
      ),
    );
  }
  if (p.enforceAdmins === false) {
    out.push(
      finding(
        "BRANCH-ENFORCE-ADMINS",
        "low",
        "Branch protection does not apply to administrators",
        "enforce_admins is off. Known and accepted until the bot identity of Guardians G3 exists.",
        "Turn on enforce_admins once agents use a non-admin identity.",
      ),
    );
  }
  return out;
}

function securityRules(snapshot) {
  const sa = snapshot.securityAndAnalysis;
  if (sa === null || sa === undefined) {
    return [
      finding(
        "UNVERIFIED-SECURITY",
        "info",
        "Security feature status could not be read",
        "The token cannot see security_and_analysis.",
        "Provide COSTSEC_TOKEN (fine-grained, read-only) to verify it.",
      ),
    ];
  }
  // The API reports each feature as { status: "enabled" | "disabled" }.
  const statusOf = (key) => sa[key]?.status ?? sa[key];
  const checks = [
    ["secret_scanning", "SECRET-SCANNING", "high", "Secret scanning is off"],
    ["secret_scanning_push_protection", "PUSH-PROTECTION", "high", "Push protection is off"],
    [
      "dependabot_security_updates",
      "DEPENDABOT-UPDATES",
      "medium",
      "Dependabot security updates are off",
    ],
  ];
  return checks
    .filter(([key]) => statusOf(key) !== "enabled")
    .map(([key, id, severity, title]) =>
      finding(
        id,
        severity,
        title,
        `${key} is "${statusOf(key) ?? "missing"}".`,
        "Enable it in the repository's security settings.",
      ),
    );
}

/** True when a line starts with `key:` (indented or not). Line-based, so no backtracking regex. */
const hasKey = (content, key) =>
  content.split("\n").some((line) => line.trimStart().startsWith(`${key}:`));

/** The text of the top-level `on:` block (inline value and indented lines), comments dropped. */
function triggerText(content) {
  const out = [];
  let inside = false;
  for (const raw of content.split("\n")) {
    const line = raw.trimEnd();
    if (line.trim() === "" || line.trimStart().startsWith("#")) continue;
    const top = !/^\s/.test(line);
    if (top) {
      inside = /^(?:on|"on"|'on')\s*:/.test(line);
      if (inside) out.push(line.slice(line.indexOf(":") + 1));
    } else if (inside) {
      out.push(line);
    }
  }
  return out.join("\n");
}

const usesPullRequestTarget = (content) =>
  triggerText(content)
    .split(/[\s,[\]{}:]+/)
    .some((word) => word === "pull_request_target");

function workflowRules(snapshot) {
  const out = [];
  if (
    snapshot.workflowDefaultPermissions === null ||
    snapshot.workflowDefaultPermissions === undefined
  ) {
    out.push(
      finding(
        "UNVERIFIED-WORKFLOW-PERMISSIONS",
        "info",
        "The default workflow permissions could not be read",
        "The token cannot see actions/permissions/workflow.",
        "Provide COSTSEC_TOKEN (fine-grained, read-only) to verify it.",
      ),
    );
  }
  if (snapshot.workflows === null || snapshot.workflows === undefined) {
    out.push(
      finding(
        "UNVERIFIED-WORKFLOWS",
        "info",
        "The workflow files could not be read",
        "The checkout has no .github/workflows directory to scan.",
        "Check that the job checks out the repository.",
      ),
    );
  }
  if (snapshot.workflowDefaultPermissions === "write") {
    out.push(
      finding(
        "WF-DEFAULT-WRITE",
        "medium",
        "Workflows get a read-write token by default",
        "default_workflow_permissions is write.",
        "Set the default to read and grant write per job.",
      ),
    );
  }
  for (const wf of snapshot.workflows ?? []) {
    if (!hasKey(wf.content, "permissions")) {
      out.push(
        finding(
          "WF-NO-PERMISSIONS",
          "medium",
          `${wf.path} does not declare permissions`,
          "No permissions: block, so it inherits the repository default.",
          "Add a top-level permissions: block (contents: read at most).",
        ),
      );
    }
    if (usesPullRequestTarget(wf.content)) {
      out.push(
        finding(
          "WF-PR-TARGET",
          "high",
          `${wf.path} runs on pull_request_target`,
          "That trigger runs with secrets in the context of untrusted forks.",
          "Use pull_request, or never check out the pull request's code.",
        ),
      );
    }
  }
  return out;
}

function alertRules(snapshot) {
  const a = snapshot.alerts;
  if (!a) return [];
  const out = [];
  if (a.dependabotHigh === null || a.codeScanningHigh === null) {
    out.push(
      finding(
        "UNVERIFIED-ALERTS",
        "info",
        "Security alerts could not be read",
        "The token cannot list Dependabot or code scanning alerts.",
        "Provide COSTSEC_TOKEN with the matching read permissions.",
      ),
    );
  }
  for (const [count, id, what] of [
    [a.dependabotHigh, "ALERTS-DEPENDABOT", "Dependabot"],
    [a.codeScanningHigh, "ALERTS-CODEQL", "code scanning"],
  ]) {
    if (typeof count === "number" && count > 0) {
      out.push(
        finding(
          id,
          "high",
          `${count} open high or critical ${what} alert${count === 1 ? "" : "s"}`,
          `${count} alert(s) at high or critical severity are still open.`,
          "Fix or dismiss each with a reason.",
        ),
      );
    }
  }
  return out;
}

export function evaluate(snapshot) {
  return [
    ...branchRules(snapshot),
    ...securityRules(snapshot),
    ...workflowRules(snapshot),
    ...alertRules(snapshot),
  ].sort((a, b) => ORDER[a.severity] - ORDER[b.severity] || a.id.localeCompare(b.id));
}

const SECRET_SHAPES = [
  /\bgh[pousr]_\w{20,}/g,
  /\bgithub_pat_\w{20,}/g,
  /\b[sr]k_(?:live|test)_\w{10,}/g,
  /\bwhsec_\w{10,}/g,
  /\bnx_test_\w{6,}/g,
];

export const redact = (text) =>
  SECRET_SHAPES.reduce((out, shape) => out.replace(shape, "[redacted]"), String(text));

export const MARKER = "<!-- nexora-costsec -->";

/** Markdown for the one tracking issue. Findings only; nothing from the snapshot is echoed. */
export function renderReport(findings, when) {
  const actionable = findings.filter((f) => f.severity !== "info" && f.severity !== "low");
  const lines = [MARKER, `CostSec configuration audit, ${when}.`, ""];
  if (findings.length === 0) lines.push("No findings.");
  for (const f of findings) {
    lines.push(
      `- **${f.severity.toUpperCase()}** \`${f.id}\`: ${f.title}`,
      `  - Evidence: ${f.evidence}`,
      `  - Suggestion: ${f.suggestion}`,
    );
  }
  lines.push(
    "",
    `${actionable.length} actionable finding(s). This issue is updated in place and closed when none remain.`,
  );
  return redact(lines.join("\n"));
}

/** Clean means nothing to fix AND nothing left unchecked: an audit that could not look is not a pass. */
export const isClean = (findings) =>
  findings.every(
    (f) => (f.severity === "info" || f.severity === "low") && !f.id.startsWith("UNVERIFIED"),
  );

/**
 * Merges classic branch protection with repository rulesets (GET /rules/branches/{branch}).
 * Either mechanism counts; a 404 from the classic endpoint does not mean "unprotected".
 */
export function mergeProtection(branch, classic, rules) {
  if (branch === null || branch === undefined) return null;
  const list = Array.isArray(rules) ? rules : [];
  const rulesChecks = list
    .filter((r) => r.type === "required_status_checks")
    .flatMap((r) => (r.parameters?.required_status_checks ?? []).map((c) => c.context));
  const classicChecks = branch.protection?.required_status_checks?.contexts ?? [];
  return {
    protected: branch.protected === true || list.length > 0,
    requiredChecks: [...new Set([...classicChecks, ...rulesChecks])],
    enforceAdmins: classic ? classic.enforce_admins?.enabled === true : null,
    allowForcePushes: list.some((r) => r.type === "non_fast_forward")
      ? false
      : classic
        ? classic.allow_force_pushes?.enabled === true
        : null,
    allowDeletions: list.some((r) => r.type === "deletion")
      ? false
      : classic
        ? classic.allow_deletions?.enabled === true
        : null,
  };
}
