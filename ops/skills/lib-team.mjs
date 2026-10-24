// Format and boundary checks for Agent Team plans and reviews and for CTO Analyst cards.
// Deterministic: a plan that breaks a boundary fails here, whatever the model thinks of it.

export const MAX_WORKERS = 4;
export const MAX_BUDGET_USD = 10;
const ID = /^[a-z][a-z0-9-]{1,30}$/;

// Agents work at tier T1 (propose, never operate). Their scopes must stay out of secrets, the
// production host, edge and Terraform, CI, and the Guardians policy itself (a human, T3).
export const FORBIDDEN_SCOPES = [
  ".github/workflows",
  "infrastructure/deployment",
  "infrastructure/edge",
  "infrastructure/terraform",
  "ops/guardians",
  "NEXORA-private-notes",
];

const normalise = (p) =>
  String(p)
    .replace(/^\.?\//, "")
    .replace(/\/+$/, "");
const covers = (a, b) => a === b || b.startsWith(`${a}/`) || a.startsWith(`${b}/`);
const sameText = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

function forbiddenHit(scope) {
  const s = normalise(scope);
  if (s === "" || s === ".") return "the whole repository";
  const hit = FORBIDDEN_SCOPES.find((f) => covers(normalise(f), s));
  if (hit) return hit;
  if (s.split("/").some((segment) => segment.startsWith(".env"))) return "an environment file";
  return /\.(pem|key)$/.test(s) ? "key files" : null;
}

function taskProblems(task, seen) {
  const label = `task "${task?.id ?? "?"}"`;
  const out = [];
  if (typeof task?.id !== "string" || !ID.test(task.id)) return [`${label}: bad id`];
  if (seen.has(task.id)) out.push(`${label}: duplicate id`);
  if (typeof task.prompt !== "string" || task.prompt.trim() === "") out.push(`${label}: no prompt`);
  if (typeof task.acceptance !== "string" || task.acceptance.trim() === "")
    out.push(`${label}: no acceptance command`);
  if (!Array.isArray(task.scope) || task.scope.length === 0) return [...out, `${label}: no scope`];
  for (const scope of task.scope) {
    const hit = forbiddenHit(scope);
    if (hit) out.push(`${label}: scope "${scope}" reaches ${hit}`);
  }
  if (!Number.isFinite(task.estimatedCostUsd) || task.estimatedCostUsd < 0)
    out.push(`${label}: estimatedCostUsd`);
  return out;
}

function overlapProblems(tasks) {
  const out = [];
  for (let i = 0; i < tasks.length; i += 1) {
    for (let j = i + 1; j < tasks.length; j += 1) {
      const [a, b] = [tasks[i], tasks[j]];
      const ordered = (a.dependsOn ?? []).includes(b.id) || (b.dependsOn ?? []).includes(a.id);
      const clash = a.scope.some((x) => b.scope.some((y) => covers(normalise(x), normalise(y))));
      if (clash && !ordered)
        out.push(`tasks "${a.id}" and "${b.id}" overlap in scope and are not ordered by dependsOn`);
    }
  }
  return out;
}

function validatorProblems(plan) {
  const v = plan.validator;
  if (!v || typeof v !== "object") return ["no validator"];
  const out = [];
  if (typeof v.prompt !== "string" || v.prompt.trim() === "") out.push("validator has no prompt");
  if (v.canWrite !== false) out.push("validator must have canWrite: false");
  if (!Array.isArray(v.runs) || !v.runs.some((r) => /test/i.test(String(r))))
    out.push("validator must run the tests");
  const tasks = Array.isArray(plan.tasks) ? plan.tasks : [];
  if (tasks.some((t) => sameText(t.prompt ?? "", v.prompt ?? "")))
    out.push("validator prompt must differ from every worker prompt");
  return out;
}

/** @returns {string[]} problems; empty means the plan respects the boundaries. */
export function validateTeamPlan(plan) {
  if (plan === null || typeof plan !== "object" || Array.isArray(plan))
    return ["the plan is not an object"];
  const tasks = Array.isArray(plan.tasks) ? plan.tasks : [];
  const out = [];
  if (typeof plan.goal !== "string" || plan.goal.trim() === "") out.push("no goal");
  if (tasks.length === 0) return [...out, "no tasks"];
  if (tasks.length > MAX_WORKERS) out.push(`${tasks.length} workers, the limit is ${MAX_WORKERS}`);
  const seen = new Set();
  for (const task of tasks) {
    out.push(...taskProblems(task, seen));
    seen.add(task?.id);
  }
  if (out.length === 0) out.push(...overlapProblems(tasks));
  const total = tasks.reduce(
    (sum, t) => sum + (Number.isFinite(t.estimatedCostUsd) ? t.estimatedCostUsd : 0),
    0,
  );
  if (!(plan.budgetUsd > 0) || plan.budgetUsd > MAX_BUDGET_USD)
    out.push(`budgetUsd must be above 0 and at most ${MAX_BUDGET_USD}`);
  else if (total > plan.budgetUsd)
    out.push(`estimated cost ${total} exceeds budgetUsd ${plan.budgetUsd}`);
  if (typeof plan.integrator !== "string" || plan.integrator.trim() === "")
    out.push("no integrator step");
  return [...out, ...validatorProblems(plan)];
}

function section(text, name) {
  const at = text.indexOf(`## ${name}`);
  if (at < 0) return null;
  const rest = text.slice(at + name.length + 3);
  const next = rest.indexOf("\n## ");
  return (next < 0 ? rest : rest.slice(0, next)).trim();
}

/** The independent validator's report. @returns {string[]} */
export function validateReviewReport(text) {
  const verdict = section(text, "Verdict");
  const commands = section(text, "Commands run");
  const diff = section(text, "Diff reviewed");
  const findings = section(text, "Findings");
  const out = [];
  for (const [name, body] of [
    ["Verdict", verdict],
    ["Commands run", commands],
    ["Diff reviewed", diff],
    ["Findings", findings],
  ]) {
    if (body === null) out.push(`missing the ## ${name} section`);
  }
  if (out.length > 0) return out;
  if (!/^(PASS|FAIL)\b/.test(verdict)) out.push("the verdict must start with PASS or FAIL");
  const ran = commands
    .split("\n")
    .filter((l) => l.trimStart().startsWith("- ") && l.includes("->"));
  if (ran.length === 0) out.push('no command with a result ("- <command> -> <result>")');
  if (!/wrote files:\s*no/i.test(text)) out.push('missing the line "Wrote files: no"');
  if (diff === "") out.push("the diff section is empty");
  const items = findings.split("\n").filter((l) => l.trimStart().startsWith("- "));
  if (verdict.startsWith("FAIL") && items.length === 0)
    out.push("a FAIL needs at least one finding");
  if (verdict.startsWith("PASS") && ran.some((l) => /->\s*(fail|error|exit [1-9])/i.test(l)))
    out.push("PASS contradicts a failing command");
  return out;
}

const CRITERIA = ["Cost", "Security", "License", "Maintenance", "Fit"];
const RECOMMENDATIONS = new Set(["adopt", "trial", "hold", "reject"]);

function scoreRows(body) {
  return body
    .split("\n")
    .filter((l) => l.trim().startsWith("|"))
    .map((l) =>
      l
        .split("|")
        .slice(1, -1)
        .map((c) => c.trim()),
    );
}

function criterionProblems(rows) {
  const out = [];
  for (const name of CRITERIA) {
    const row = rows.find((r) => r[0] === name);
    if (!row) out.push(`no score row for ${name}`);
    else if (!/^[1-5]$/.test(row[1] ?? ""))
      out.push(`${name}: the score must be an integer from 1 to 5`);
    else if (!row[2]) out.push(`${name}: no evidence`);
    else if (!/https?:\/\//.test(row[3] ?? "")) out.push(`${name}: no source link`);
  }
  return out;
}

/** A CTO Analyst evaluation card with its ADR draft. @returns {string[]} */
export function validateCtoCard(text) {
  const scores = section(text, "Scores");
  const rec = section(text, "Recommendation");
  const adr = section(text, "ADR draft");
  const out = [];
  if (!section(text, "Candidate")) out.push("missing the ## Candidate section");
  if (scores === null) out.push("missing the ## Scores section");
  if (rec === null) out.push("missing the ## Recommendation section");
  if (adr === null) out.push("missing the ## ADR draft section");
  if (out.length > 0) return out;
  out.push(...criterionProblems(scoreRows(scores)));
  const word = rec
    .split(/\s+/)[0]
    ?.toLowerCase()
    .replace(/[^a-z]/g, "");
  if (!RECOMMENDATIONS.has(word))
    out.push("the recommendation must start with adopt, trial, hold or reject");
  for (const part of ["Status: Proposed", "Context", "Decision", "Consequences"]) {
    if (!adr.includes(part)) out.push(`the ADR draft lacks "${part}"`);
  }
  return out;
}
