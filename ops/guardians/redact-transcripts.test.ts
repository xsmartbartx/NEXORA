import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
// @ts-expect-error plain ESM module, no type declarations
import { redactText, run } from "./redact-transcripts.mjs";

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), "redact-transcripts.mjs");
const OLD = Date.now() - 60 * 60 * 1000;

// Secret-shaped values are assembled at runtime so no literal one sits in the source.
const stripe = ["sk", "live", "A1b2C3d4E5f6G7h8"].join("_");
const github = ["gh", "p_"].join("") + "B".repeat(36);
const anthropic = ["sk", "ant", "api03", "C".repeat(30)].join("-");
const aws = "AKIA" + "D".repeat(16);

const line = (text: string) => `${JSON.stringify({ type: "user", message: { content: text } })}\n`;
const tmp = () => mkdtempSync(path.join(os.tmpdir(), "transcripts-"));
const write = (file: string, content: string, mtime = OLD) => {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content);
  utimesSync(file, mtime / 1000, mtime / 1000);
};

describe("redactText", () => {
  it("replaces every supported shape and counts them", () => {
    const r = redactText(`a ${stripe} b ${github} c ${anthropic} d ${aws}`);
    expect(r.count).toBe(4);
    for (const secret of [stripe, github, anthropic, aws]) expect(r.text).not.toContain(secret);
    expect(r.text.match(/\[redacted\]/g)).toHaveLength(4);
  });

  it("leaves ordinary text alone and keeps JSON valid", () => {
    const text = line(`token ${stripe} and plain words`);
    const r = redactText(text);
    expect(r.count).toBe(1);
    expect(() => JSON.parse(r.text.trim())).not.toThrow();
    expect(redactText("nothing secret here").count).toBe(0);
  });

  it("does not count text that already says [redacted]", () => {
    expect(redactText("x [redacted] y").count).toBe(0);
  });
});

describe("run", () => {
  it("a dry run reports counts and changes nothing", () => {
    const dir = tmp();
    const file = path.join(dir, "proj", "a.jsonl");
    write(file, line(`key ${stripe}`));
    const results = run(dir, { apply: false });
    expect(results).toEqual([{ file, count: 1, skipped: null }]);
    expect(readFileSync(file, "utf8")).toContain(stripe);
  });

  it("--apply rewrites the file in place and leaves no temp file behind", () => {
    const dir = tmp();
    const file = path.join(dir, "a.jsonl");
    write(file, line(`one ${stripe}`) + line(`two ${github}`) + line("clean"));
    run(dir, { apply: true });
    const after = readFileSync(file, "utf8");
    expect(after).not.toContain(stripe);
    expect(after).not.toContain(github);
    expect(
      after
        .trim()
        .split("\n")
        .map((l) => JSON.parse(l)),
    ).toHaveLength(3);
    expect(run(dir, { apply: false })[0].count).toBe(0);
    expect(readFileSync(file, "utf8")).toBe(after);
  });

  it("skips a file modified in the last 10 minutes, even with --apply", () => {
    const dir = tmp();
    const file = path.join(dir, "live.jsonl");
    write(file, line(`key ${stripe}`), Date.now());
    const [r] = run(dir, { apply: true });
    expect(r.skipped).toMatch(/10 minutes/);
    expect(readFileSync(file, "utf8")).toContain(stripe);
  });

  it("ignores non-jsonl files and symlinks", () => {
    const dir = tmp();
    write(path.join(dir, "notes.txt"), `key ${stripe}`);
    const outside = tmp();
    write(path.join(outside, "x.jsonl"), line(`key ${stripe}`));
    symlinkSync(outside, path.join(dir, "link"));
    expect(run(dir, { apply: true })).toEqual([]);
    expect(readFileSync(path.join(outside, "x.jsonl"), "utf8")).toContain(stripe);
  });
});

describe("the command line", () => {
  it("never prints a matched value, in a dry run or with --apply", () => {
    const dir = tmp();
    write(path.join(dir, "a.jsonl"), line(`key ${stripe} ${github}`));
    const dry = spawnSync(process.execPath, [script, "--dir", dir], { encoding: "utf8" });
    expect(dry.status).toBe(0);
    expect(dry.stdout).toContain("2 value(s) in 1 file(s)");
    expect(dry.stdout).toContain("dry run");
    expect(dry.stdout + dry.stderr).not.toContain(stripe);
    const real = spawnSync(process.execPath, [script, "--dir", dir, "--apply"], {
      encoding: "utf8",
    });
    expect(real.stdout + real.stderr).not.toContain(github);
    expect(real.stdout).toContain("rewritten");
  });

  it("refuses --dir without a path", () => {
    expect(spawnSync(process.execPath, [script, "--dir"], { encoding: "utf8" }).status).toBe(2);
  });
});
