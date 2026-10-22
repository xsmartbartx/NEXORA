import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
// @ts-expect-error plain ESM module, no type declarations
import { analyse, collect, parseLog, prefixOf } from "./czujka-metadata.mjs";
// @ts-expect-error plain ESM module, no type declarations
import { validateCzujkaReport, validateEndReport } from "./lib.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const tmp = () => mkdtempSync(path.join(os.tmpdir(), "skills-"));
const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(" ");

const improvement = (n: number, drop?: string) =>
  `### ${n}. Title ${n}\n` +
  [
    ["Metric", "restore drill duration"],
    ["Baseline", "7 s (runs.jsonl, 2026-10-22)"],
    ["Target", "under 5 s"],
    ["Measurement", "node ops/worker/worker.mjs status"],
  ]
    .filter(([k]) => k !== drop)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n") +
  "\n";
const endReport = (summaryWords: number, improvements: string) =>
  `## Summary\n${words(summaryWords)}\n\n## Improvements\n${improvements}`;

describe("End report format", () => {
  it("accepts a short summary with three complete improvements", () => {
    const text = endReport(120, [1, 2, 3].map((n) => improvement(n)).join("\n"));
    expect(validateEndReport(text)).toEqual([]);
  });

  it("accepts an explicit 'No improvement proposed'", () => {
    expect(validateEndReport(endReport(50, "No improvement proposed.\n"))).toEqual([]);
  });

  it("rejects a summary of 300 words or more, accepts 299", () => {
    expect(validateEndReport(endReport(300, improvement(1)))).toHaveLength(1);
    expect(validateEndReport(endReport(299, improvement(1)))).toEqual([]);
  });

  it("rejects a fourth improvement", () => {
    const text = endReport(50, [1, 2, 3, 4].map((n) => improvement(n)).join("\n"));
    expect(validateEndReport(text).join()).toMatch(/4 improvements/);
  });

  it.each(["Metric", "Baseline", "Target", "Measurement"])(
    "rejects an improvement without %s",
    (field) => {
      const problems = validateEndReport(endReport(50, improvement(1, field)));
      expect(problems).toEqual([`improvement "1. Title 1": missing ${field}`]);
    },
  );

  it("rejects an empty field value, missing sections, and padding without a statement", () => {
    expect(
      validateEndReport(endReport(50, improvement(1).replace("7 s (runs.jsonl, 2026-10-22)", " "))),
    ).toHaveLength(1);
    expect(validateEndReport("just text").length).toBeGreaterThan(0);
    expect(validateEndReport(endReport(50, "\n"))).toHaveLength(1);
  });
});

describe("Czujka report format", () => {
  const proposal = (drop?: string) =>
    "### Automate the lockfile sync\n" +
    [
      ["Source", "git log, 30 days"],
      ["Frequency", "20 commits in 30 days"],
      ["Estimated saving", "5 min x 20 = 100 min"],
      ["Risk", "a bad lockfile; CI runs npm ci"],
    ]
      .filter(([k]) => k !== drop)
      .map(([k, v]) => `- ${k}: ${v}`)
      .join("\n");

  it("accepts a complete proposal and an honest 'too thin'", () => {
    expect(validateCzujkaReport(proposal())).toEqual([]);
    expect(validateCzujkaReport("The data is too thin to propose anything.")).toEqual([]);
  });

  it.each(["Source", "Frequency", "Estimated saving", "Risk"])(
    "rejects a proposal without %s",
    (field) => {
      expect(validateCzujkaReport(proposal(field))).toEqual([
        `proposal "Automate the lockfile sync": missing ${field}`,
      ]);
    },
  );

  it("rejects an empty report", () => {
    expect(validateCzujkaReport("")).toHaveLength(1);
  });
});

describe("the validator command line", () => {
  const run = (kind: string, text: string) => {
    const file = path.join(tmp(), "r.md");
    writeFileSync(file, text);
    return spawnSync(process.execPath, [path.join(here, "validate-report.mjs"), kind, file], {
      encoding: "utf8",
    });
  };

  it("exits 0 for a good report and 1 with reasons for a bad one", () => {
    expect(run("end", endReport(50, improvement(1))).status).toBe(0);
    const bad = run("end", endReport(50, improvement(1, "Target")));
    expect(bad.status).toBe(1);
    expect(bad.stderr).toContain("missing Target");
  });

  it("exits 2 on bad usage", () => {
    expect(run("nope", "x").status).toBe(2);
  });
});

describe("Czujka metadata", () => {
  it("reduces subjects to a prefix with numbers folded and secrets redacted", () => {
    expect(prefixOf("Fix prettier formatting in 12 files")).toBe("fix prettier formatting");
    expect(prefixOf("Merge pull request #57 from x/y")).toBe("merge pull request");
    const fake = ["gh", "p_"].join("") + "A".repeat(30);
    expect(prefixOf(`leak ${fake}`)).not.toContain("AAAA");
  });

  it("finds repeated prefixes, hot paths and files changed together, and ignores bulk commits", () => {
    const commits = [
      ...Array.from({ length: 4 }, (_, i) => ({
        hash: `h${i}`,
        date: `2026-10-0${i + 1}T00:00:00Z`,
        author: "a",
        subject: `Fix lockfile sync ${i}`,
        files: ["package-lock.json", "apps/x/package.json"],
      })),
      {
        hash: "bulk",
        date: "2026-10-09T00:00:00Z",
        author: "b",
        subject: "Reformat",
        files: Array.from({ length: 40 }, (_, i) => `f${i}.ts`),
      },
    ];
    const r = analyse(commits, 3);
    expect(r.commits).toBe(5);
    expect(r.authors).toBe(2);
    expect(r.repeatedPrefixes[0]).toEqual({ prefix: "fix lockfile sync", count: 4 });
    expect(r.hotPaths.map((p: { file: string }) => p.file)).toContain("package-lock.json");
    expect(r.changedTogether).toEqual([
      { pair: "apps/x/package.json + package-lock.json", count: 4 },
    ]);
    expect(r.fixShare).toBe(0.8);
  });

  it("parses git's log format", () => {
    const text =
      "@abc|2026-10-01T00:00:00Z|Ann|Fix: a|b\na.ts\nb.ts\n\n@def|2026-10-02T00:00:00Z|Bob|Add c\nc.ts\n";
    const commits = parseLog(text);
    expect(commits).toHaveLength(2);
    expect(commits[0]).toMatchObject({ subject: "Fix: a|b", files: ["a.ts", "b.ts"] });
  });

  it("reads names and counts only: a secret in a file's content or diff never reaches the output", () => {
    const dir = tmp();
    const git = (...args: string[]) =>
      execFileSync("/usr/bin/git", args, { cwd: dir, stdio: "pipe" });
    git("init", "-q");
    git("config", "user.email", "t@example.com");
    git("config", "user.name", "T");
    const secret = ["sk", "live", "ABCDEFGHIJKLMNOP"].join("_");
    for (let i = 0; i < 3; i += 1) {
      writeFileSync(path.join(dir, "config.txt"), `token=${secret}${i}\n`);
      git("add", ".");
      git("commit", "-q", "-m", `Update config ${i}`);
    }
    const out = JSON.stringify(collect({ cwd: dir, since: "30 days ago", min: 3 }));
    expect(out).not.toContain(secret);
    expect(out).not.toContain("token=");
    expect(out).toContain("config.txt");
    expect(out).toContain("update config");
  });

  it("refuses a since value that is not a plain date or age", () => {
    expect(() => collect({ since: "1 day ago; rm -rf /" })).toThrow(/since must look like/);
  });
});
