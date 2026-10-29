import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dir = path.dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(path.join(dir, name), "utf8");
const rehearsal = read("restore-rehearsal.sh");
const drill = read("restore-drill.sh");

describe("restore-rehearsal.sh", () => {
  it("is valid bash and stops on any error", () => {
    expect(spawnSync("bash", ["-n", path.join(dir, "restore-rehearsal.sh")]).status).toBe(0);
    expect(rehearsal).toContain("set -euo pipefail");
  });

  it("restores each database on the Postgres major its dump was made with", () => {
    expect(rehearsal).toContain("restore nexora postgres:16-alpine");
    expect(rehearsal).toContain("restore vigilo postgres:16-alpine");
    expect(rehearsal).toContain("restore neurawall postgres:17-alpine");
  });

  it("only ever starts throwaway containers: it never execs into a production one", () => {
    expect(rehearsal).not.toMatch(/docker exec (nexora|vigilo|neurawall)-/);
    expect(rehearsal).toContain('name="rehearsal-$1-$$"');
    expect(rehearsal).toContain("docker rm -f");
  });

  it("reports an error count for every database so a bad restore cannot look like a pass", () => {
    expect(rehearsal).toContain("errors: ${errors}");
  });
});

describe("restore-drill.sh", () => {
  it("is valid bash", () => {
    expect(spawnSync("bash", ["-n", path.join(dir, "restore-drill.sh")]).status).toBe(0);
  });

  it("follows the major version recorded in the dump, with an override and a fallback", () => {
    expect(drill).toContain("Dumped from database version");
    expect(drill).toContain("PG_IMAGE");
    expect(drill).toContain("FALLBACK_IMAGE=postgres:16-alpine");
  });

  it("still fails loudly on any restore error", () => {
    expect(drill).toContain("--exit-on-error");
    expect(drill).toContain("RESTORE DRILL FAILED");
  });
});
