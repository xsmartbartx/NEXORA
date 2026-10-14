#!/usr/bin/env node
// NEXORA Guardians G2: the forced command for the agent's SSH key on the production host.
//
// sshd runs this instead of whatever the client asked for (authorized_keys `command=`); the
// client's text arrives in SSH_ORIGINAL_COMMAND. It is parsed against a closed registry: no
// shell is ever involved, every argument is validated, anything unknown is refused. Calls that
// change the host need an approval a human created beforehand (see `approve`). Every call,
// allowed or refused, is logged. `--dry-run` prints what would run and runs nothing.
//
//   audit ports|disk|containers|sshd|backups     tier T0, read-only
//   deploy <project> <service...>                tier T2, via deploy.sh
//   restore-drill                                tier T2
//
// Human side (never reachable through SSH, which only ever sets SSH_ORIGINAL_COMMAND):
//   nexora-guard.mjs approve "deploy nexora db-migrate" [ttlSeconds]
//
// Not a sandbox: it narrows what the key can ask for. The host user, sudoers and file
// permissions (ops/guardians/host/README.md) are what make the narrowing hold.

import { createHash, randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const DEPLOY = "/opt/nexora/infrastructure/deployment/deploy.sh";
export const DRILL = "/opt/nexora/infrastructure/deployment/restore-drill.sh";
const DEFAULT_TTL_S = 600;
const MAX_TTL_S = 3600;
const MAX_COMMAND = 300;

const PROJECTS = {
  nexora: new Set([
    "website",
    "account",
    "console",
    "api",
    "gateway",
    "docs",
    "developers",
    "status",
    "sentinel",
    "cspm",
    "db-migrate",
    "grafana",
    "prometheus",
  ]),
  vigilo: null, // service names are Vigilo's own; checked by shape only
  neurawall: null,
  edge: new Set(),
};
// Services whose deploy changes data or exposure: approval required even for a deploy.
const GUARDED_SERVICES = new Set(["db-migrate"]);
const NAME = /^[a-z][a-z0-9-]{0,40}$/;

const AUDITS = {
  ports: ["ss", "-tlnH"],
  disk: ["df", "-h", "--output=source,size,used,avail,pcent,target"],
  containers: ["docker", "ps", "--format", "{{.Names}}\t{{.Status}}"],
  sshd: ["sshd", "-T"],
  backups: ["ls", "-l", "--time-style=long-iso", "/opt/backups"],
};
const SUDO_AUDITS = new Set(["sshd", "containers"]);

const refuse = (reason) => ({ ok: false, reason });

/** Split on spaces only. Anything that is not a plain word is refused, so no quoting is needed. */
function words(command) {
  if (typeof command !== "string" || command.trim() === "") return null;
  if (command.length > MAX_COMMAND) return null;
  if (!/^[\w ./:@=,-]+$/.test(command)) return null;
  return command.trim().split(/ +/);
}

/** @returns {{ok:true, argv:string[], tier:"T0"|"T2", needsApproval:boolean, normalized:string, dryRun:boolean}|{ok:false, reason:string}} */
export function resolve(command) {
  let parts = words(command);
  if (!parts) return refuse("not a plain command");
  let dryRun = false;
  if (parts[0] === "--dry-run") {
    dryRun = true;
    parts = parts.slice(1);
  }
  const [verb, ...args] = parts;
  const done = (argv, tier, needsApproval) => ({
    ok: true,
    argv,
    tier,
    needsApproval,
    normalized: parts.join(" "),
    dryRun,
  });

  if (verb === "audit") {
    const [what, ...rest] = args;
    if (rest.length > 0 || !Object.hasOwn(AUDITS, what ?? "")) return refuse("unknown audit");
    const argv = AUDITS[what];
    return done(SUDO_AUDITS.has(what) ? ["sudo", "-n", ...argv] : argv, "T0", false);
  }

  if (verb === "restore-drill") {
    if (args.length > 0) return refuse("restore-drill takes no arguments");
    return done(["sudo", "-n", "-u", "opc", DRILL], "T2", false);
  }

  if (verb === "deploy") {
    const [project, ...services] = args;
    if (!Object.hasOwn(PROJECTS, project ?? "")) return refuse("unknown project");
    const known = PROJECTS[project];
    if (project === "edge") {
      if (services.length > 0) return refuse("edge takes no services");
    } else if (services.length === 0 || services.length > 8) {
      return refuse("name 1 to 8 services");
    }
    for (const s of services) {
      if (!NAME.test(s) || (known && !known.has(s))) return refuse(`service not allowed: ${s}`);
    }
    const guarded = project === "edge" || services.some((s) => GUARDED_SERVICES.has(s));
    return done(["sudo", "-n", "-u", "opc", DEPLOY, project, ...services], "T2", guarded);
  }

  return refuse("unknown command");
}

const hashOf = (normalized) => createHash("sha256").update(normalized).digest("hex");

/** Creates an approval for one exact command. Run by a human on the host. */
export function approve(dir, normalized, ttlSeconds, now = Date.now()) {
  const ttl = Math.min(Math.max(Number(ttlSeconds) || DEFAULT_TTL_S, 1), MAX_TTL_S);
  const id = randomBytes(8).toString("hex");
  mkdirSync(dir, { recursive: true, mode: 0o750 });
  const record = { id, hash: hashOf(normalized), expires: now + ttl * 1000 };
  writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(record), { mode: 0o640 });
  return { id, expiresAt: new Date(record.expires).toISOString() };
}

/**
 * True when a still-valid approval for exactly this command exists and has not been used.
 * Use is recorded by appending to `used.log` (the agent user cannot edit approvals).
 */
export function consumeApproval(dir, normalized, now = Date.now()) {
  const used = new Set(
    existsSync(path.join(dir, "used.log"))
      ? readFileSync(path.join(dir, "used.log"), "utf8").split("\n").filter(Boolean)
      : [],
  );
  const want = hashOf(normalized);
  const found = listRecords(dir).find((r) => r.hash === want && r.expires > now && !used.has(r.id));
  if (!found) return null;
  appendFileSync(path.join(dir, "used.log"), `${found.id}\n`);
  return found.id;
}

function listRecords(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSafe(dir)) {
    if (!/^[0-9a-f]{16}\.json$/.test(name)) continue;
    try {
      const r = JSON.parse(readFileSync(path.join(dir, name), "utf8"));
      if (typeof r.id === "string" && typeof r.hash === "string" && Number.isFinite(r.expires))
        out.push(r);
    } catch {
      // a corrupt approval is no approval
    }
  }
  return out;
}

function readdirSafe(dir) {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

function log(file, entry) {
  try {
    appendFileSync(file, `${JSON.stringify({ ts: new Date().toISOString(), ...entry })}\n`);
  } catch {
    // logging must never decide the outcome, but a refused call still exits non-zero
  }
}

function main() {
  const dir = process.env.NEXORA_GUARD_DIR ?? "/opt/nexora/guard";
  const logFile = process.env.NEXORA_GUARD_LOG ?? "/var/log/nexora-guard.jsonl";
  const original = process.env.SSH_ORIGINAL_COMMAND;

  if (original === undefined) {
    const [mode, command, ttl] = process.argv.slice(2);
    if (mode !== "approve" || !command) {
      console.error('usage: nexora-guard.mjs approve "<command>" [ttlSeconds]');
      process.exit(2);
    }
    const r = resolve(command);
    if (!r.ok || !r.needsApproval) {
      console.error(r.ok ? "that command does not need an approval" : `refused: ${r.reason}`);
      process.exit(2);
    }
    const made = approve(path.join(dir, "approvals"), r.normalized.replace(/^--dry-run /, ""), ttl);
    console.log(`approved "${r.normalized}" until ${made.expiresAt} (id ${made.id}), single use`);
    return;
  }

  const r = resolve(original);
  const who = (process.env.SSH_CONNECTION ?? "").split(" ")[0] ?? "";
  if (!r.ok) {
    log(logFile, {
      event: "refused",
      reason: r.reason,
      from: who,
      command: original.slice(0, 120),
    });
    console.error(`nexora-guard: refused (${r.reason})`);
    process.exit(126);
  }
  if (r.dryRun) {
    log(logFile, { event: "dry-run", tier: r.tier, command: r.normalized, from: who });
    console.log(
      `dry run, would run: ${r.argv.join(" ")}${r.needsApproval ? " (needs an approval)" : ""}`,
    );
    return;
  }
  if (r.needsApproval) {
    const id = consumeApproval(path.join(dir, "approvals"), r.normalized);
    if (!id) {
      log(logFile, {
        event: "refused",
        reason: "no valid approval",
        command: r.normalized,
        from: who,
      });
      console.error("nexora-guard: this needs a human approval (single use, short lived)");
      process.exit(126);
    }
    log(logFile, { event: "approved", approval: id, command: r.normalized, from: who });
  }
  log(logFile, { event: "exec", tier: r.tier, command: r.normalized, from: who });
  try {
    execFileSync(r.argv[0], r.argv.slice(1), { stdio: "inherit" });
    log(logFile, { event: "done", command: r.normalized, status: 0 });
  } catch (error) {
    log(logFile, { event: "done", command: r.normalized, status: error.status ?? 1 });
    process.exit(typeof error.status === "number" ? error.status : 1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
