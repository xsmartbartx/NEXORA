import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
// @ts-expect-error plain ESM module, no type declarations
import { approve, consumeApproval, DEPLOY, resolve } from "./nexora-guard.mjs";

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), "nexora-guard.mjs");
const ok = (c: string) =>
  resolve(c) as {
    ok: true;
    argv: string[];
    tier: string;
    needsApproval: boolean;
    normalized: string;
    dryRun: boolean;
  };
const refused = (c: string) => expect(resolve(c).ok).toBe(false);
const tmp = () => mkdtempSync(path.join(os.tmpdir(), "guard-"));

describe("what the key may ask for", () => {
  it.each(["ports", "disk", "containers", "sshd", "backups"])(
    "allows audit %s as T0 without approval",
    (what) => {
      const r = ok(`audit ${what}`);
      expect(r).toMatchObject({ tier: "T0", needsApproval: false });
    },
  );

  it("deploys named services through deploy.sh as opc, without a shell", () => {
    const r = ok("deploy nexora website console");
    expect(r.argv).toEqual(["sudo", "-n", "-u", "opc", DEPLOY, "nexora", "website", "console"]);
    expect(r.needsApproval).toBe(false);
  });

  it("requires approval for the migration and for the shared edge", () => {
    expect(ok("deploy nexora db-migrate").needsApproval).toBe(true);
    expect(ok("deploy nexora website db-migrate").needsApproval).toBe(true);
    expect(ok("deploy edge").needsApproval).toBe(true);
  });

  it("allows the restore drill and --dry-run", () => {
    expect(ok("restore-drill").tier).toBe("T2");
    expect(ok("--dry-run deploy nexora website").dryRun).toBe(true);
  });
});

describe("what it refuses", () => {
  it.each([
    "",
    "   ",
    "ls",
    "bash",
    "sudo su",
    "rm -rf /",
    "cat /opt/nexora/infrastructure/docker/.env.prod",
    "audit ports; id",
    "audit ports && id",
    "audit $(id)",
    "audit `id`",
    "audit ports | sh",
    "audit ports > /etc/x",
    "audit env",
    "audit ports extra",
    "audit",
    "deploy",
    "deploy prod website",
    "deploy nexora",
    "deploy nexora ../x",
    "deploy nexora Website",
    "deploy nexora nope",
    "deploy nexora -f",
    "deploy edge website",
    "restore-drill now",
    "deploy nexora a b c d e f g h i",
    "scp x y",
    "docker run x",
    "psql",
    "audit constructor",
  ])("refuses %j", (c) => refused(c));

  it("refuses an overlong command and non-strings", () => {
    refused(`deploy nexora ${"website ".repeat(100)}`);
    expect(resolve(undefined as unknown as string).ok).toBe(false);
  });

  it("refuses newlines and quotes that could smuggle a second command", () => {
    refused("audit ports\nid");
    refused("audit 'ports'");
    refused('audit "ports"');
  });
});

describe("approvals", () => {
  const cmd = "deploy nexora db-migrate";

  it("accepts a fresh approval for exactly that command, once", () => {
    const dir = tmp();
    approve(dir, cmd, 60, 1000);
    expect(consumeApproval(dir, cmd, 2000)).toMatch(/^[0-9a-f]{16}$/);
    expect(consumeApproval(dir, cmd, 3000)).toBeNull();
  });

  it("expires after the TTL", () => {
    const dir = tmp();
    approve(dir, cmd, 60, 1000);
    expect(consumeApproval(dir, cmd, 1000 + 61_000)).toBeNull();
  });

  it("does not cover a different command or different services", () => {
    const dir = tmp();
    approve(dir, cmd, 60, 1000);
    expect(consumeApproval(dir, "deploy nexora db-migrate website", 2000)).toBeNull();
    expect(consumeApproval(dir, "deploy edge", 2000)).toBeNull();
  });

  it("caps the TTL at an hour and ignores corrupt files", () => {
    const dir = tmp();
    const made = approve(dir, cmd, 999_999, 0);
    expect(Date.parse(made.expiresAt)).toBe(3600 * 1000);
    writeFileSync(path.join(dir, "0123456789abcdef.json"), "{not json");
    expect(consumeApproval(dir, "deploy edge", 1)).toBeNull();
  });
});

describe("the real entry point", () => {
  const run = (
    original: string | undefined,
    env: Record<string, string> = {},
    args: string[] = [],
  ) => {
    const dir = tmp();
    const logFile = path.join(dir, "log.jsonl");
    const res = spawnSync(process.execPath, [script, ...args], {
      encoding: "utf8",
      env: {
        PATH: process.env.PATH ?? "",
        NEXORA_GUARD_DIR: dir,
        NEXORA_GUARD_LOG: logFile,
        ...(original === undefined ? {} : { SSH_ORIGINAL_COMMAND: original }),
        ...env,
      },
    });
    let log: string[] = [];
    try {
      log = readFileSync(logFile, "utf8").trim().split("\n");
    } catch {
      // no log written
    }
    return { ...res, log: log.map((l) => JSON.parse(l)), dir };
  };

  it("refuses an unknown command with 126 and logs it", () => {
    const r = run("rm -rf /");
    expect(r.status).toBe(126);
    expect(r.log[0]).toMatchObject({ event: "refused" });
  });

  it("dry-run prints the plan, runs nothing and logs it", () => {
    const r = run("--dry-run deploy nexora website");
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("dry run, would run: sudo -n -u opc");
    expect(r.log.map((l) => l.event)).toEqual(["dry-run"]);
  });

  it("refuses a guarded deploy without an approval", () => {
    const r = run("deploy nexora db-migrate");
    expect(r.status).toBe(126);
    expect(r.stderr).toContain("human approval");
    expect(r.log[0]).toMatchObject({ event: "refused", reason: "no valid approval" });
  });

  it("the approve mode is unreachable through SSH and only approves guarded commands", () => {
    // Over SSH SSH_ORIGINAL_COMMAND is always set, so the argv path is never taken.
    const viaSsh = run("approve deploy nexora db-migrate", {}, [
      "approve",
      "deploy nexora db-migrate",
    ]);
    expect(viaSsh.status).toBe(126);
    const human = run(undefined, {}, ["approve", "deploy nexora db-migrate", "30"]);
    expect(human.status).toBe(0);
    expect(human.stdout).toContain("single use");
    const needless = run(undefined, {}, ["approve", "audit ports"]);
    expect(needless.status).toBe(2);
  });
});
