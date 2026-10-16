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
  if (typeof maxCostUsd !== "number" || !(maxCostUsd >= 0) || maxCostUsd > 10)
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

const stateFile = (dir, job, period) => path.join(dir, "runs", `${job.id}__${period}.json`);

function readState(dir, job, period) {
  try {
    return JSON.parse(readFileSync(stateFile(dir, job, period), "utf8"));
  } catch {
    return null;
  }
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
  try {
    return parseBudget(JSON.parse(readFileSync(path.join(dir, "budget.json"), "utf8")));
  } catch {
    // no file: fall back to the repository's default limit
    return parseBudget(JSON.parse(readFileSync(path.join(here, "../costsec/budget.json"), "utf8")));
  }
}

const log = (dir, entry) =>
  appendFileSync(
    path.join(dir, "runs.jsonl"),
    `${JSON.stringify({ ts: new Date().toISOString(), ...entry })}\n`,
  );

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

  if (!job.enabled) return skip("disabled");
  if (existsSync(path.join(dir, "KILL"))) return skip("kill-switch");
  const { ok, reason: cfgReason, budget } = readBudget(dir);
  if (!ok) return skip(`budget config invalid (${cfgReason})`);
  const spent = monthSpend(readLedger(dir), new Date(now).toISOString().slice(0, 7));
  if (!canSpend(budget, spent, job.maxCostUsd))
    return skip(`budget (${assess(budget, spent).state})`);

  const previous = readState(dir, job, period);
  if (previous?.status === "succeeded") return skip("already succeeded this period");
  if (previous?.status === "running") return skip("another run holds this period");
  if (previous && previous.attempts >= MAX_ATTEMPTS)
    return skip(`gave up after ${MAX_ATTEMPTS} failed attempts`);

  if (job.requiresApproval && !consumeApproval(path.join(dir, "approvals"), job.command, now)) {
    return skip("needs a human approval");
  }

  const resolved = resolveCommand(job.command);
  if (!resolved.ok) return skip("command no longer allowed");

  // The claim: an exclusive create. A failed earlier attempt is removed first, so the claim below is
  // still the single point where two starters race and exactly one wins.
  const file = stateFile(dir, job, period);
  const attempts = (previous?.attempts ?? 0) + 1;
  if (previous) rmSync(file, { force: true });
  try {
    writeFileSync(
      file,
      JSON.stringify({ status: "running", attempts, startedAt: new Date(now).toISOString() }),
      { flag: "wx" },
    );
  } catch {
    return skip("claimed by another starter");
  }
  log(dir, { event: "started", job: job.id, period, attempt: attempts });

  let result;
  try {
    result = await ctx.exec(resolved.argv, job.timeoutSeconds * 1000);
  } catch (error) {
    result = { status: 1, error: String(error?.message ?? error).slice(0, 200) };
  }
  const succeeded = result.status === 0;
  writeFileSync(
    file,
    JSON.stringify({
      status: succeeded ? "succeeded" : "failed",
      attempts,
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
    attempt: attempts,
    exit: result.status,
    error: result.error,
  });

  if (!succeeded) {
    // A notifier that throws (synchronously or not) must never turn a recorded failure into a crash.
    try {
      await ctx.notify?.({
        source: `worker.${job.id}`,
        title: `Job ${job.id} failed (attempt ${attempts} of ${MAX_ATTEMPTS})`,
        severity: "warning",
        detail: `Period ${period}. Rollback: ${job.rollback}`,
      });
    } catch {
      log(dir, { event: "notify-failed", job: job.id, period });
    }
  }
  return { outcome: succeeded ? "succeeded" : "failed", period, attempts };
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
    "docker",
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

async function main() {
  const dir = process.env.NEXORA_WORKER_DIR ?? "/opt/nexora/worker";
  const [mode, jobId] = process.argv.slice(2);
  const { jobs, errors } = loadJobs();
  for (const e of errors) console.error(`registry error: ${e}`);
  if (errors.length > 0) process.exit(2);
  mkdirSync(dir, { recursive: true });

  if (mode === "status") {
    for (const job of jobs) {
      const period = periodKey(job.schedule, Date.now());
      const s = readState(dir, job, period);
      console.log(
        `${job.id}\t${job.schedule}\t${period}\t${s?.status ?? "not run"}${job.enabled ? "" : "\t(disabled)"}`,
      );
    }
    return;
  }
  const chosen =
    mode === "run-due" ? jobs : mode === "run" ? jobs.filter((j) => j.id === jobId) : null;
  if (!chosen || chosen.length === 0) {
    console.error("usage: worker.mjs run-due | run <jobId> | status");
    process.exit(2);
  }
  let failed = false;
  for (const job of chosen) {
    const r = await runJob(job, { dir, now: Date.now(), exec: realExec, notify: hubNotify });
    console.log(`${job.id}: ${r.outcome}${r.reason ? ` (${r.reason})` : ""}`);
    if (r.outcome === "failed") failed = true;
  }
  if (failed) process.exit(1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
