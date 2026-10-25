import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), "backup-all.sh");
const text = readFileSync(script, "utf8");

describe("backup-all.sh", () => {
  it("is valid bash and fails on any error", () => {
    expect(spawnSync("bash", ["-n", script]).status).toBe(0);
    expect(text).toContain("set -euo pipefail");
  });

  it("uploads in one part: multipart needs permissions the instance policy does not grant", () => {
    const upload = text.slice(text.indexOf("oci os object put"));
    expect(upload.split("\n").slice(0, 3).join(" ")).toContain("--no-multipart");
  });

  it("uses instance principal and never refers to stored credentials", () => {
    expect(text).toContain("--auth instance_principal");
    expect(text).not.toMatch(/password|secret|token|api[_-]?key/i);
  });

  it("only advances the heartbeat after a successful off-site upload", () => {
    const afterUpload = text.slice(text.indexOf("OK off-site"));
    expect(afterUpload).toContain("HEARTBEAT");
    expect(text.indexOf("HEARTBEAT.tmp")).toBeGreaterThan(text.indexOf("OK off-site"));
  });
});
