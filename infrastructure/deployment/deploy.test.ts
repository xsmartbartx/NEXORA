import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { resolve } from "../../ops/guardians/host/nexora-guard.mjs";

// deploy.sh only runs on the production host (absolute paths, the host lock), so these
// tests read it rather than run it.
const here = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(here, "deploy.sh");
const text = readFileSync(script, "utf8");

/** The body of one `case` branch, from `  name)` to its `;;`. */
function branch(name: string): string {
  const start = text.indexOf(`\n  ${name})\n`);
  expect(start, `deploy.sh has a ${name} branch`).toBeGreaterThan(-1);
  return text.slice(start, text.indexOf("\n    ;;\n", start));
}

const codeOnly = (s: string) =>
  s
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("#"))
    .join("\n");

const usage = text.match(/usage: deploy\.sh ([a-z|]+) /)?.[1].split("|") ?? [];

describe("deploy.sh", () => {
  it("is valid bash and fails on any error", () => {
    expect(spawnSync("bash", ["-n", script]).status).toBe(0);
    expect(text).toContain("set -euo pipefail");
  });

  it("has a branch for every project in its usage line, and names them all when refusing", () => {
    expect(usage).toEqual(expect.arrayContaining(["linegist", "omniflow"]));
    const refusal = text.match(/Unknown project: \$project \(expected ([^)]+)\)/)?.[1] ?? "";
    for (const project of usage) {
      branch(project);
      expect(refusal).toContain(project);
    }
  });

  it("lets the agent deploy Linegist and OmniFlow through the host guard", () => {
    expect(resolve("deploy linegist").ok).toBe(true);
    expect(resolve("deploy omniflow omniflow site").ok).toBe(true);
  });

  it("deploys Linegist as a whole and runs its migration before the app restarts", () => {
    // Code only: the branch's comment explains why --no-deps and "standalone" are left out.
    const linegist = codeOnly(branch("linegist"));
    expect(linegist).toContain("checkout=/home/opc/linegist");
    expect(linegist).toContain("git pull --ff-only");
    expect(linegist).toContain("takes no service names");
    expect(linegist).toContain("sudo docker compose build migrate app");
    // --no-deps would skip the migrate service that app depends on.
    expect(linegist).toMatch(/sudo docker compose up -d app$/m);
    expect(linegist).not.toContain("--no-deps");
    expect(linegist).not.toContain("standalone");
  });

  it("deploys only OmniFlow's server and site, both by default", () => {
    const omniflow = branch("omniflow");
    expect(omniflow).toContain("checkout=/home/opc/omniflow");
    expect(omniflow).toContain("git pull --ff-only");
    expect(omniflow).toContain('[ "$#" -gt 0 ] || set -- omniflow site');
    expect(omniflow).toContain("omniflow | site) ;;");
    expect(omniflow).toContain('sudo docker compose up -d --no-deps "$@"');
    expect(omniflow.indexOf("Unknown OmniFlow service")).toBeLessThan(omniflow.indexOf("git pull"));
  });

  it("reports the commit from the checkout each project uses", () => {
    expect(text).toContain('git -C "${checkout:-/opt/${project/edge/nexora}}" log --oneline -1');
  });
});
