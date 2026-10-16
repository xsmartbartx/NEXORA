#!/usr/bin/env node
// NEXORA Cloud Worker (v1): runs approved jobs from ops/worker/jobs/*.json, at most once per period.
//
//   worker.mjs run-due        run every enabled job that has no finished run in its current period
//   worker.mjs run <jobId>    run one job now (same rules)
//   worker.mjs status         print the state of every job
//
// What makes it safe to leave running on a timer:
//   - idempotent: the claim for (job, period) is an exclusive file create, so a second start in the
//     same period (cron overlap, a retry, two hosts on a shared disk) cannot run it again;
//   - bounded: a kill switch, the monthly spend limit (ops/costsec/budget.mjs) and a per-job cost
//     ceiling are checked before anything starts; a timeout ends a stuck job;
//   - closed: a job names a command from the Guardians G2 registry (nexora-guard.mjs resolve), never
//     a free-form shell line, and guarded commands still need a human approval;
//   - visible: every outcome is one line in runs.jsonl, a failure also goes to the Notification Hub.
// State lives in files under NEXORA_WORKER_DIR (default /opt/nexora/worker), not in Postgres.

import { execFileSync } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assess, canSpend, monthSpend, parseBudget } from "../costsec/budget.mjs";
import { consumeApproval, resolve as resolveCommand } from "../guardians/host/nexora-guard.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const SCHEDULES = new Set(["daily", "weekly", "monthly"]);
const ID = /^[a-z][a-z0-9-]{1,40}$/;
const MAX_ATTEMPTS = 3;

/** @returns {{ok:true, job:object}|{ok:false, reason:string}} */
export function parseJob(raw) {
  const bad = (reason) => ({ ok: false, reason });
  if (raw === null || typeof raw !== "object") return bad("not an object");
  const {
    id,
    title,
    schedule,
    command,
    maxCostUsd,
    timeoutSeconds,
    requiresApproval,
    enabled,
    rollback,
  } = raw;
  if (typeof id !== "string" || !ID.test(id)) return bad("id");
  if (typeof title !== "string" || title.length === 0 || title.length > 120) return bad("title");
  if (!SCHEDULES.has(schedule)) return bad("schedule");
  if (typeof command !== "string") return bad("command");
  const resolved = resolveCommand(command);
  if (!resolved.ok) return bad(`command refused by the guard registry (${resolved.reason})`);
  if (
    typeof maxCostUsd !== "number" ||
    maxCostUsd < 0 ||
    Number.isNaN(maxCostUsd) ||
    maxCostUsd > 10
  )
    return bad("maxCostUsd");
  if (!Number.isInteger(timeoutSeconds) || timeoutSeconds < 1 || timeoutSeconds > 7200)
    return bad("timeoutSeconds");
  if (typeof requiresApproval !== "boolean" || typeof enabled !== "boolean") return bad("flags");
  if (typeof rollback !== "string" || rollback.trim().length < 10)
    return bad("rollback must be described");
  if (resolved.needsApproval && !requiresApproval)
    return bad("the command needs approval, so requiresApproval must be true");
  return {
    ok: true,
    job: {
      id,
      title,
      schedule,
      command: resolved.normalized,
      maxCostUsd,
      timeoutSeconds,
      requiresApproval,
      enabled,
      rollback,
    },
  };
}

const pad = (n) => String(n).padStart(2, "0");

/** The UTC period a run belongs to: 2026-10-16, 2026-W42 (ISO week) or 2026-10. */
export function periodKey(schedule, now) {
  const d = new Date(now);
  if (schedule === "daily") return d.toISOString().slice(0, 10);
  if (schedule === "monthly") return d.toISOString().slice(0, 7);
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const week = Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 86_400_000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${pad(week)}`;
}

export function loadJobs(dir = path.join(here, "jobs")) {
  const jobs = [];
  const errors = [];
  for (const name of readdirSync(dir)
    .filter((n) => n.endsWith(".json"))
    .sort()) {
    try {
      const parsed = parseJob(JSON.parse(readFileSync(path.join(dir, name), "utf8")));
      if (parsed.ok) jobs.push(parsed.job);
      else errors.push(`${name}: ${parsed.reason}`);
    } catch {
      errors.push(`${name}: not valid JSON`);
    }
  }
  return { jobs, errors };
}

// One file per attempt: runs/<job>__<period>.<n>.json. A retry creates the next number with an
// exclusive create and never deletes or rewrites anyone else's file, so two starters cannot both win.
const attemptFile = (dir, job, period, n) =>
  path.join(dir, "runs", `${job.id}__${period}.${n}.json`);

/** Attempts recorded for this (job, period), oldest first: [{ n, status }]. */
function readAttempts(dir, job, period) {
  const prefix = `${job.id}__${period}.`;
  return readdirSync(path.join(dir, "runs"))
    .filter((name) => name.startsWith(prefix) && name.endsWith(".json"))
    .map((name) => Number(name.slice(prefix.length, -".json".length)))
    .filter((n) => Number.isInteger(n) && n > 0)
    .sort((x, y) => x - y)
    .map((n) => {
      try {
        return {
          n,
          status: JSON.parse(readFileSync(attemptFile(dir, job, period, n), "utf8")).status,
        };
      } catch {
        return { n, status: "running" }; // unreadable: treat as unfinished, never as free
      }
    });
}

function readLedger(dir) {
  try {
    return readFileSync(path.join(dir, "ledger.jsonl"), "utf8")
      .split("\n")
      .filter(Boolean)
      .flatMap((l) => {
        try {
          return [JSON.parse(l)];
        } catch {
          return [];
        }
      });
  } catch {
    return [];
  }
}

function readBudget(dir) {
  let text;
  try {
    text = readFileSync(path.join(dir, "budget.json"), "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") return parseBudget(null); // unreadable host file: stop
    text = readFileSync(path.join(here, "../costsec/budget.json"), "utf8"); // none: repository default
  }
  try {
    return parseBudget(JSON.parse(text));
  } catch {
    return parseBudget(null); // present but not JSON: stop, do not fall back
  }
}

const log = (dir, entry) =>
  appendFileSync(
    path.join(dir, "runs.jsonl"),
    `${JSON.stringify({ ts: new Date().toISOString(), ...entry })}\n`,
  );

/** Why this job must not start now, or null. Checks only; nothing is claimed or consumed. */
function blockedReason(job, ctx, attempts) {
  const { dir, now } = ctx;
  if (!job.enabled) return "disabled";
  if (existsSync(path.join(dir, "KILL"))) return "kill-switch";
  const { ok, reason, budget } = readBudget(dir);
  if (!ok) return `budget config invalid (${reason})`;
  const spent = monthSpend(readLedger(dir), new Date(now).toISOString().slice(0, 7));
  if (!canSpend(budget, spent, job.maxCostUsd)) return `budget (${assess(budget, spent).state})`;
  if (attempts.some((a) => a.status === "succeeded")) return "already succeeded this period";
  if (attempts.some((a) => a.status === "running")) return "another run holds this period";
  if (attempts.length >= MAX_ATTEMPTS) return `gave up after ${MAX_ATTEMPTS} failed attempts`;
  return null;
}

async function execute(job, ctx, argv) {
  try {
    return await ctx.exec(argv, job.timeoutSeconds * 1000);
  } catch (error) {
    return { status: 1, error: String(error?.message ?? error).slice(0, 200) };
  }
}

async function notifyFailure(job, ctx, period, attempt) {
  // A notifier that throws (synchronously or not) must never turn a recorded failure into a crash.
  try {
    await ctx.notify?.({
      source: `worker.${job.id}`,
      title: `Job ${job.id} failed (attempt ${attempt} of ${MAX_ATTEMPTS})`,
      severity: "warning",
      detail: `Period ${period}. Rollback: ${job.rollback}`,
    });
  } catch {
    log(ctx.dir, { event: "notify-failed", job: job.id, period });
  }
}

/**
 * Runs one job if, and only if, it is due and allowed. `ctx`: { dir, now, exec, notify }.
 * exec(argv, timeoutMs) -> {status, error?}; notify(message) is called on failure.
 */
export async function runJob(job, ctx) {
  const { dir, now } = ctx;
  mkdirSync(path.join(dir, "runs"), { recursive: true });
  const period = periodKey(job.schedule, now);
  const skip = (reason) => {
    log(dir, { event: "skipped", job: job.id, period, reason });
    return { outcome: "skipped", reason, period };
  };

  const attempts = readAttempts(dir, job, period);
  const blocked = blockedReason(job, ctx, attempts);
  if (blocked) return skip(blocked);
  const resolved = resolveCommand(job.command);
  if (!resolved.ok) return skip("command no longer allowed");

  // The claim: an exclusive create of the next attempt's file. Whoever creates it owns the attempt.
  const attempt = (attempts.at(-1)?.n ?? 0) + 1;
  const file = attemptFile(dir, job, period, attempt);
  try {
    writeFileSync(
      file,
      JSON.stringify({ status: "running", startedAt: new Date(now).toISOString() }),
      {
        flag: "wx",
      },
    );
  } catch {
    return skip("claimed by another starter");
  }

  // The single-use approval is spent only after the claim is won, so a loser wastes nothing.
  if (job.requiresApproval && !consumeApproval(path.join(dir, "approvals"), job.command, now)) {
    rmSync(file, { force: true }); // our own claim, released: nothing ran
    return skip("needs a human approval");
  }
  log(dir, { event: "started", job: job.id, period, attempt });

  const result = await execute(job, ctx, resolved.argv);
  const succeeded = result.status === 0;
  writeFileSync(
    file,
    JSON.stringify({
      status: succeeded ? "succeeded" : "failed",
      finishedAt: new Date().toISOString(),
      exit: result.status,
    }),
  );
  appendFileSync(
    path.join(dir, "ledger.jsonl"),
    `${JSON.stringify({ ts: new Date(now).toISOString(), job: job.id, costUsd: 0 })}\n`,
  );
  log(dir, {
    event: succeeded ? "succeeded" : "failed",
    job: job.id,
    period,
    attempt,
    exit: result.status,
    error: result.error,
  });
  if (!succeeded) await notifyFailure(job, ctx, period, attempt);
  return { outcome: succeeded ? "succeeded" : "failed", period, attempts: attempt };
}

function realExec(argv, timeoutMs) {
  try {
    execFileSync(argv[0], argv.slice(1), { stdio: "ignore", timeout: timeoutMs });
    return { status: 0 };
  } catch (error) {
    return {
      status: typeof error.status === "number" ? error.status : 1,
      error: error.code ?? error.signal ?? "failed",
    };
  }
}

/** Pushes a failure to the Notification Hub through the console container (the token never leaves it). */
async function hubNotify(event) {
  const body = JSON.stringify({ ...event, status: "firing" });
  execFileSync(
    "/usr/bin/docker",
    [
      "exec",
      "-i",
      "nexora-console-1",
      "sh",
      "-c",
      'wget -q -O- -T 20 --header "Content-Type: application/json" --header "Authorization: Bearer $OPS_HUB_TOKEN" --post-file=- http://127.0.0.1:3002/api/internal/ops/events',
    ],
    { input: body, stdio: ["pipe", "ignore", "ignore"], timeout: 30_000 },
  );
}

function printStatus(dir, jobs) {
  for (const job of jobs) {
    const period = periodKey(job.schedule, Date.now());
    const last = readAttempts(dir, job, period).at(-1);
    const flag = job.enabled ? "" : "\t(disabled)";
    console.log([job.id, job.schedule, period, last?.status ?? "not run"].join("\t") + flag);
  }
}

function chooseJobs(mode, jobId, jobs) {
  if (mode === "run-due") return jobs;
  if (mode === "run") return jobs.filter((j) => j.id === jobId);
  return [];
}

async function main() {
  const dir = process.env.NEXORA_WORKER_DIR ?? "/opt/nexora/worker";
  const [mode, jobId] = process.argv.slice(2);
  const { jobs, errors } = loadJobs();
  for (const e of errors) console.error(`registry error: ${e}`);
  if (errors.length > 0) process.exit(2);
  mkdirSync(path.join(dir, "runs"), { recursive: true });

  if (mode === "status") {
    printStatus(dir, jobs);
    return;
  }
  const chosen = chooseJobs(mode, jobId, jobs);
  if (chosen.length === 0) {
    console.error("usage: worker.mjs run-due | run <jobId> | status");
    process.exit(2);
  }
  let failed = false;
  for (const job of chosen) {
    // Jobs run one after another on purpose: they share the host and the budget.
    const r = await runJob(job, { dir, now: Date.now(), exec: realExec, notify: hubNotify }); // NOSONAR
    console.log(job.id + ": " + r.outcome + (r.reason ? " (" + r.reason + ")" : ""));
    if (r.outcome === "failed") failed = true;
  }
  if (failed) process.exit(1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
