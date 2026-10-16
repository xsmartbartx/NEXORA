import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
// @ts-expect-error plain ESM module, no type declarations
import { approve } from "../guardians/host/nexora-guard.mjs";
// @ts-expect-error plain ESM module, no type declarations
import { loadJobs, parseJob, periodKey, runJob } from "./worker.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const tmp = () => mkdtempSync(path.join(os.tmpdir(), "worker-"));
const NOW = Date.parse("2026-10-16T05:00:00Z");

const base = {
  id: "backup-listing",
  title: "t",
  schedule: "daily",
  command: "audit backups",
  maxCostUsd: 0,
  timeoutSeconds: 60,
  requiresApproval: false,
  enabled: true,
  rollback: "Read-only, nothing to undo.",
};
const job = (over: Record<string, unknown> = {}) => {
  const parsed = parseJob({ ...base, ...over });
  if (!parsed.ok) throw new Error(parsed.reason);
  return parsed.job;
};
const ctx = (dir: string, over: Record<string, unknown> = {}) => ({
  dir,
  now: NOW,
  exec: vi.fn(async (_argv: string[], _timeoutMs: number) => ({ status: 0 })),
  notify: vi.fn(async (_event: Record<string, unknown>) => undefined),
  ...over,
});
const lines = (dir: string) =>
  readFileSync(path.join(dir, "runs.jsonl"), "utf8")
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l));

/** Starts the same job `starters` times at once with a slow executor; returns how many succeeded. */
async function race(dir: string, theJob: ReturnType<typeof job>, starters: number) {
  const slow = vi.fn(
    () => new Promise<{ status: number }>((r) => setTimeout(() => r({ status: 0 }), 20)),
  );
  const results = await Promise.all(
    Array.from({ length: starters }, () => runJob(theJob, ctx(dir, { exec: slow }))),
  );
  return {
    succeeded: results.filter((r: { outcome: string }) => r.outcome === "succeeded").length,
    ran: slow.mock.calls.length,
  };
}

describe("the registry", () => {
  it("accepts the jobs that ship in the repository", () => {
    const { jobs, errors } = loadJobs();
    expect(errors).toEqual([]);
    expect(jobs.map((j: { id: string }) => j.id).sort()).toEqual([
      "backup-listing",
      "restore-drill",
    ]);
  });

  it.each([
    ["a free-form command", { command: "bash -c id" }],
    ["a command with shell syntax", { command: "audit ports; id" }],
    ["an unknown schedule", { schedule: "hourly" }],
    ["a bad id", { id: "Bad Id" }],
    ["a cost ceiling above 10 USD", { maxCostUsd: 11 }],
    ["a negative cost", { maxCostUsd: -1 }],
    ["a missing rollback description", { rollback: "" }],
    ["no timeout", { timeoutSeconds: 0 }],
    ["a guarded command without requiresApproval", { command: "deploy nexora db-migrate" }],
  ])("rejects %s", (_n, over) => {
    expect(parseJob({ ...base, ...over }).ok).toBe(false);
  });

  it("keeps the guard's normalised form of the command", () => {
    expect(job({ command: "audit   backups" }).command).toBe("audit backups");
  });
});

describe("periods (UTC)", () => {
  it("daily, monthly and ISO weeks", () => {
    expect(periodKey("daily", NOW)).toBe("2026-10-16");
    expect(periodKey("monthly", NOW)).toBe("2026-10");
    expect(periodKey("weekly", NOW)).toBe("2026-W42");
    expect(periodKey("weekly", Date.parse("2026-01-01T00:00:00Z"))).toBe("2026-W01");
    expect(periodKey("weekly", Date.parse("2027-01-01T00:00:00Z"))).toBe("2026-W53");
  });
});

describe("running a job", () => {
  it("runs once per period: a second start does not run it again", async () => {
    const dir = tmp();
    const c = ctx(dir);
    expect(await runJob(job(), c)).toMatchObject({ outcome: "succeeded", period: "2026-10-16" });
    expect(await runJob(job(), c)).toMatchObject({
      outcome: "skipped",
      reason: "already succeeded this period",
    });
    expect(c.exec).toHaveBeenCalledTimes(1);
    expect(await runJob(job(), { ...c, now: NOW + 86_400_000 })).toMatchObject({
      outcome: "succeeded",
    });
    expect(c.exec).toHaveBeenCalledTimes(2);
  });

  it("two simultaneous starters: exactly one runs", async () => {
    const dir = tmp();
    expect(await race(dir, job(), 2)).toEqual({ succeeded: 1, ran: 1 });
  });

  it("the kill switch stops everything", async () => {
    const dir = tmp();
    writeFileSync(path.join(dir, "KILL"), "");
    const c = ctx(dir);
    expect(await runJob(job(), c)).toMatchObject({ outcome: "skipped", reason: "kill-switch" });
    expect(c.exec).not.toHaveBeenCalled();
  });

  it("a disabled job does not run", async () => {
    const c = ctx(tmp());
    expect((await runJob(job({ enabled: false }), c)).reason).toBe("disabled");
    expect(c.exec).not.toHaveBeenCalled();
  });

  it("stops when the monthly budget is spent, or the job's ceiling would not fit", async () => {
    const dir = tmp();
    writeFileSync(
      path.join(dir, "ledger.jsonl"),
      `${JSON.stringify({ ts: "2026-10-02T00:00:00Z", costUsd: 9.5 })}\n`,
    );
    const c = ctx(dir);
    expect((await runJob(job({ maxCostUsd: 1 }), c)).reason).toMatch(/budget/);
    expect(c.exec).not.toHaveBeenCalled();
    expect((await runJob(job({ maxCostUsd: 0 }), c)).outcome).toBe("succeeded");
  });

  it("fails closed on a broken budget file", async () => {
    const dir = tmp();
    writeFileSync(
      path.join(dir, "budget.json"),
      JSON.stringify({ monthlyLimitUsd: -5, warnRatio: 0.8, killSwitch: false }),
    );
    const c = ctx(dir);
    expect((await runJob(job(), c)).reason).toMatch(/budget config invalid/);
    expect(c.exec).not.toHaveBeenCalled();
  });

  it("a failed run notifies, can be retried, and gives up after three attempts", async () => {
    const dir = tmp();
    const c = ctx(dir, { exec: vi.fn(async () => ({ status: 3 })) });
    for (let i = 1; i <= 3; i += 1) {
      expect(await runJob(job(), c)).toMatchObject({ outcome: "failed", attempts: i });
    }
    expect(c.notify).toHaveBeenCalledTimes(3);
    expect(c.notify).toHaveBeenLastCalledWith(
      expect.objectContaining({
        source: "worker.backup-listing",
        detail: expect.stringContaining("Rollback:"),
      }),
    );
    expect((await runJob(job(), c)).reason).toMatch(/gave up/);
    expect(c.exec).toHaveBeenCalledTimes(3);
  });

  it("a notifier that throws synchronously does not crash the run", async () => {
    const dir = tmp();
    const c = ctx(dir, {
      exec: vi.fn(async () => ({ status: 1 })),
      notify: () => {
        throw new Error("no docker");
      },
    });
    expect((await runJob(job(), c)).outcome).toBe("failed");
    expect(lines(dir).map((l: { event: string }) => l.event)).toContain("notify-failed");
  });

  it("a thrown exec error is a failure, not a crash", async () => {
    const dir = tmp();
    const c = ctx(dir, {
      exec: vi.fn(async () => {
        throw new Error("boom");
      }),
    });
    expect((await runJob(job(), c)).outcome).toBe("failed");
    expect(lines(dir).at(-1)).toMatchObject({ event: "failed", error: "boom" });
  });

  it("a run that never finished blocks the period instead of running twice", async () => {
    const dir = tmp();
    mkdirSync(path.join(dir, "runs"), { recursive: true });
    writeFileSync(
      path.join(dir, "runs", "backup-listing__2026-10-16.1.json"),
      JSON.stringify({ status: "running" }),
    );
    const c = ctx(dir);
    expect((await runJob(job(), c)).reason).toBe("another run holds this period");
    expect(c.exec).not.toHaveBeenCalled();
  });

  it("an invalid host budget file stops the worker instead of falling back to the default", async () => {
    const dir = tmp();
    writeFileSync(path.join(dir, "budget.json"), "{not json");
    const c = ctx(dir);
    expect((await runJob(job(), c)).reason).toMatch(/budget config invalid/);
    expect(c.exec).not.toHaveBeenCalled();
  });

  it("simultaneous retries after a failure: exactly one wins the next attempt, nobody's claim is deleted", async () => {
    const dir = tmp();
    await runJob(job(), ctx(dir, { exec: vi.fn(async () => ({ status: 1 })) }));
    expect(await race(dir, job(), 3)).toEqual({ succeeded: 1, ran: 1 });
  });

  it("the claim is won before the single-use approval is spent: one approval, two starters, one run", async () => {
    const dir = tmp();
    const guarded = job({ command: "deploy edge", requiresApproval: true });
    approve(path.join(dir, "approvals"), "deploy edge", 60, NOW);
    expect(await race(dir, guarded, 2)).toEqual({ succeeded: 1, ran: 1 });
    const used = readFileSync(path.join(dir, "approvals", "used.log"), "utf8")
      .trim()
      .split("\n");
    expect(used).toHaveLength(1);
  });

  it("a guarded job needs a single-use approval for its exact command", async () => {
    const dir = tmp();
    const guarded = job({ command: "deploy edge", requiresApproval: true });
    const c = ctx(dir);
    expect((await runJob(guarded, c)).reason).toBe("needs a human approval");
    approve(path.join(dir, "approvals"), "deploy edge", 60, NOW);
    expect((await runJob(guarded, c)).outcome).toBe("succeeded");
    expect(c.exec).toHaveBeenCalledTimes(1);
    expect(existsSync(path.join(dir, "approvals", "used.log"))).toBe(true);
  });

  it("runs the guard's resolved argv, never the raw command text", async () => {
    const c = ctx(tmp());
    await runJob(job({ command: "restore-drill", schedule: "monthly", timeoutSeconds: 1800 }), c);
    expect(c.exec.mock.calls[0][0].slice(0, 4)).toEqual(["sudo", "-n", "-u", "opc"]);
    expect(c.exec.mock.calls[0][1]).toBe(1_800_000);
  });
});

describe("the command line", () => {
  const run = (...args: string[]) =>
    spawnSync(process.execPath, [path.join(here, "worker.mjs"), ...args], {
      encoding: "utf8",
      env: { PATH: process.env.PATH ?? "", NEXORA_WORKER_DIR: tmp() },
    });

  it("status lists every job without running anything", () => {
    const r = run("status");
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("restore-drill\tmonthly");
    expect(r.stdout).toContain("backup-listing\tdaily");
    expect(r.stdout).toContain("not run");
  });

  it("refuses an unknown mode", () => {
    expect(run("rm").status).toBe(2);
  });
});
