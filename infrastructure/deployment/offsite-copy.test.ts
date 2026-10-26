import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), "offsite-copy.sh");
const text = readFileSync(script, "utf8");

// A throwaway host: fake gpg and rclone on PATH that record how they were called, a fake
// archive directory, and a remote that is just a local folder.
function host(opts: { config?: string | null; failRclone?: boolean; shortUpload?: boolean } = {}) {
  const root = mkdtempSync(path.join(os.tmpdir(), "offsite-"));
  const bin = path.join(root, "bin");
  const remote = path.join(root, "remote");
  const archives = path.join(root, "archives");
  for (const dir of [bin, remote, archives]) mkdirSync(dir, { recursive: true });
  const calls = path.join(root, "calls.log");

  writeFileSync(
    path.join(bin, "gpg"),
    `#!/usr/bin/env bash
echo "gpg $*" >> "${calls}"
out=""; prev=""
for a in "$@"; do [[ "$prev" == "--output" ]] && out="$a"; prev="$a"; done
last="\${@: -1}"
{ printf 'ENC:'; cat "$last"; } > "$out"
`,
  );
  writeFileSync(
    path.join(bin, "rclone"),
    `#!/usr/bin/env bash
echo "rclone $*" >> "${calls}"
case "$1" in
  copyto)
    ${opts.failRclone ? "exit 3" : ""}
    ${opts.shortUpload ? 'head -c 3 "$2" > "${3#remote:}"' : 'cp "$2" "${3#remote:}"'}
    ;;
  size) printf '{"count":1,"bytes":%s}' "$(wc -c < "\${3#remote:}" | tr -d ' ')" ;;
esac
`,
  );
  chmodSync(path.join(bin, "gpg"), 0o755);
  chmodSync(path.join(bin, "rclone"), 0o755);

  const config = path.join(root, "offsite.env");
  if (opts.config !== null) {
    writeFileSync(
      config,
      opts.config ?? `OFFSITE_GPG_RECIPIENT=backup@example.test\nOFFSITE_REMOTE=remote:${remote}\n`,
    );
  }
  writeFileSync(path.join(archives, "platform-backup-20261001T030000Z.tar.gz"), "old");
  writeFileSync(path.join(archives, "platform-backup-20261002T030000Z.tar.gz"), "newest archive");

  const state = path.join(root, "copied.txt");
  const heartbeat = path.join(root, "hb", "offsite-last-success");
  const run = () =>
    spawnSync("bash", [script], {
      encoding: "utf8",
      env: {
        PATH: `${bin}:${process.env.PATH ?? ""}`,
        OFFSITE_CONFIG: config,
        OFFSITE_ARCHIVES: archives,
        OFFSITE_STATE: state,
        OFFSITE_HEARTBEAT: heartbeat,
      },
    });
  const log = () => (existsSync(calls) ? readFileSync(calls, "utf8") : "");
  return { run, log, remote, state, heartbeat, archives };
}

describe("offsite-copy.sh", () => {
  it("is valid bash and stops on any error", () => {
    expect(spawnSync("bash", ["-n", script]).status).toBe(0);
    expect(text).toContain("set -euo pipefail");
  });

  it("encrypts the newest archive with a public key and uploads only the encrypted file", () => {
    const h = host();
    const r = h.run();
    expect(r.status).toBe(0);
    expect(h.log()).toMatch(/gpg .*--encrypt --recipient backup@example\.test/);
    const uploaded = readFileSync(
      path.join(h.remote, "platform-backup-20261002T030000Z.tar.gz.gpg"),
      "utf8",
    );
    expect(uploaded).toBe("ENC:newest archive");
    expect(existsSync(path.join(h.remote, "platform-backup-20261001T030000Z.tar.gz.gpg"))).toBe(
      false,
    );
    expect(readFileSync(h.state, "utf8")).toContain("platform-backup-20261002T030000Z.tar.gz");
    expect(existsSync(h.heartbeat)).toBe(true);
  });

  it("never gives the host a way to decrypt: no passphrase, no --decrypt, no secret key use", () => {
    expect(text).not.toMatch(/--decrypt|--passphrase|--symmetric|secret-key|gpg -d/);
    expect(text).toContain("--encrypt --recipient");
  });

  it("copies each archive once: a second run skips it and does not call gpg or rclone again", () => {
    const h = host();
    h.run();
    const before = h.log();
    const r = h.run();
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("already copied");
    expect(h.log()).toBe(before);
  });

  it.each([
    ["no config file", { config: null }, /is missing/],
    ["no recipient", { config: "OFFSITE_REMOTE=remote:x\n" }, /OFFSITE_GPG_RECIPIENT/],
    ["no remote", { config: "OFFSITE_GPG_RECIPIENT=a@b\n" }, /OFFSITE_REMOTE/],
  ])("fails with a clear message and no upload when there is %s", (_n, opts, message) => {
    const h = host(opts);
    const r = h.run();
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(message);
    expect(h.log()).toBe("");
    expect(existsSync(h.heartbeat)).toBe(false);
  });

  it("a failed upload exits non-zero, records nothing and does not advance the heartbeat", () => {
    const h = host({ failRclone: true });
    const r = h.run();
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("upload failed");
    expect(existsSync(h.heartbeat)).toBe(false);
    expect(readFileSync(h.state, "utf8")).toBe("");
  });

  it("a truncated upload (size mismatch) is a failure, not a success", () => {
    const h = host({ shortUpload: true });
    const r = h.run();
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("size mismatch");
    expect(existsSync(h.heartbeat)).toBe(false);
    expect(readFileSync(h.state, "utf8")).toBe("");
  });
});
