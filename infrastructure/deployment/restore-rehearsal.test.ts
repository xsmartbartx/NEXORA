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
    expect(rehearsal).toContain("restore codereviewer postgres:17-alpine");
    expect(rehearsal).toContain("restore prism postgres:16-alpine");
  });

  it("lists each data volume archive, tolerating archives made before it was added", () => {
    expect(rehearsal).toContain(
      "for f in neurawall-data.tar.gz vigilo-minio.tar.gz prism-data.tar.gz",
    );
    expect(rehearsal).toContain('echo "$f: not in this archive"');
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

  it("reads the major version from a real pg_restore header (with or without a colon)", () => {
    const program = /sed -n '([^']+)'/.exec(
      drill.slice(drill.indexOf("Dumped from database version") - 40),
    )?.[1];
    expect(program).toBeDefined();
    const major = (line: string) =>
      spawnSync("sed", ["-n", program as string], { input: line + "\n" })
        .stdout.toString()
        .trim();
    // pg_restore -l prints "version: 17.11" (PostgreSQL 16 and 17); older ones had no colon.
    expect(major(";     Dumped from database version: 17.11")).toBe("17");
    expect(major(";     Dumped from database version: 16.15")).toBe("16");
    expect(major("; Dumped from database version 15.4")).toBe("15");
    expect(major("; Dumped by pg_dump version: 17.11")).toBe("");
  });

  it("still fails loudly on any restore error", () => {
    expect(drill).toContain("--exit-on-error");
    expect(drill).toContain("RESTORE DRILL FAILED");
  });

  it.each([
    ["nexora", ['drill nexora "${NEXORA_TABLES[@]}"']],
    [
      "codereviewer",
      [
        'drill codereviewer "${CODEREVIEWER_TABLES[@]}"',
        "CODEREVIEWER_TABLES=(accounts repositories reviews)",
      ],
    ],
    [
      "prism",
      [
        'drill prism "${PRISM_TABLES[@]}"',
        "PRISM_TABLES=(users datasets dataset_versions audit_events)",
        "./prism-postgres.dump",
      ],
    ],
  ])("drills the %s database with its expected tables", (_db, needles) => {
    for (const needle of needles) expect(drill).toContain(needle);
  });

  it("only ever restores into throwaway containers it removes again", () => {
    expect(drill).not.toMatch(/docker exec (nexora|codereviewer|prism)-postgres/);
    expect(drill).toContain('name="$1-restore-drill-$$"');
    expect(drill).toContain("docker rm -f");
  });
});
