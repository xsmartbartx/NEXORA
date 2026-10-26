import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), "docker-cleanup.sh");
const text = readFileSync(script, "utf8");

describe("docker-cleanup.sh", () => {
  it("is valid bash and fails on any error", () => {
    expect(spawnSync("bash", ["-n", script]).status).toBe(0);
    expect(text).toContain("set -euo pipefail");
  });

  it("takes the deploy lock, so it never runs in the middle of a build", () => {
    expect(text).toContain("/opt/.platform-deploy.lock");
    expect(text.indexOf("flock")).toBeLessThan(text.indexOf("docker builder prune"));
  });

  it("caps the cache with --max-used-space and never with the deprecated --keep-storage", () => {
    expect(text).toMatch(/builder prune -f --max-used-space "\$\{MAX_CACHE_GB\}gb"/);
    expect(text).not.toMatch(/builder prune[^\n]*--keep-storage/);
    expect(text).toContain("CACHE_MAX_GB:-12");
  });

  it("applies the age filter first, then the cap, then the full prune only when the disk is still full", () => {
    const age = text.indexOf("until=${KEEP}h");
    const cap = text.indexOf("--max-used-space");
    const full = text.indexOf("builder prune -af");
    expect(age).toBeGreaterThan(-1);
    expect(cap).toBeGreaterThan(age);
    expect(full).toBeGreaterThan(cap);
    expect(text.slice(cap, full)).toContain('"$(pct)" -ge "$THRESHOLD"');
  });

  it("logs what was freed and flags a run that leaves the disk too full", () => {
    expect(text).toContain("WARN disk still");
    expect(text).toContain("build cache freed");
  });
});
