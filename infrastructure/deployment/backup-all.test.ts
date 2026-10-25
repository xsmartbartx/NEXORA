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

  it("expires old archives before it writes the new one", () => {
    expect(text.indexOf("-mtime +14 -delete")).toBeGreaterThan(-1);
    expect(text.indexOf("-mtime +14 -delete")).toBeLessThan(text.indexOf('tar czf "$archive"'));
  });

  it("refuses to archive a volume that does not exist instead of backing up an empty one", () => {
    const check = text.indexOf("docker volume inspect");
    expect(check).toBeGreaterThan(-1);
    expect(check).toBeLessThan(text.indexOf("docker run --rm"));
    for (const volume of ["neurawall_cpdata", "vigilo-self-host_vigilo_self_host_minio_data"]) {
      expect(text.slice(0, text.indexOf("docker volume inspect") + 200)).toContain(volume);
    }
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
