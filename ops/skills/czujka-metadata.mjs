#!/usr/bin/env node
// Czujka's only data source: metadata from git history. It reads commit subjects (reduced to a
// short prefix), dates, authors counted, and the NAMES of changed files. It never reads a file's
// contents or a diff. Output is JSON on stdout.
//
//   node ops/skills/czujka-metadata.mjs [--since "30 days ago"] [--min 3]

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { redact } from "../costsec/policy.mjs";

const GIT = "/usr/bin/git";
const BULK_COMMIT_FILES = 30; // a commit touching more files than this says nothing about co-change
const AGE = /^\d{1,3} (?:days?|weeks?|months?) ago$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const validSince = (since) => AGE.test(since) || DATE.test(since);

/** First three words of a subject, lower-cased, numbers folded, secrets redacted. */
export function prefixOf(subject) {
  const folded = redact(subject).toLowerCase().replace(/#\d+/g, "#n").replace(/\d+/g, "n");
  if (folded.startsWith("merge pull request")) return "merge pull request";
  return folded
    .split(/[^a-z#()/-]+/)
    .filter(Boolean)
    .slice(0, 3)
    .join(" ");
}

/** Parses `git log --format=@%H|%aI|%an|%s --name-only` output into commits. */
export function parseLog(text) {
  const commits = [];
  for (const chunk of text.split("\n@").filter(Boolean)) {
    const [head, ...files] = chunk.replace(/^@/, "").split("\n");
    const [hash, date, author, ...subject] = head.split("|");
    if (!hash || !date) continue;
    commits.push({
      hash,
      date,
      author,
      subject: subject.join("|"),
      files: files.filter(Boolean),
    });
  }
  return commits;
}

const bump = (map, key, by = 1) => map.set(key, (map.get(key) ?? 0) + by);
const top = (map, min, limit) =>
  [...map.entries()]
    .filter(([, n]) => n >= min)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit);

function countPairs(files, pairs) {
  if (files.length < 2 || files.length > BULK_COMMIT_FILES) return;
  const sorted = [...files].sort((x, y) => x.localeCompare(y));
  for (let i = 0; i < sorted.length; i += 1) {
    for (let j = i + 1; j < sorted.length; j += 1) bump(pairs, `${sorted[i]} + ${sorted[j]}`);
  }
}

function tally(commits) {
  const t = {
    prefixes: new Map(),
    paths: new Map(),
    pairs: new Map(),
    authors: new Set(),
    fixes: 0,
    reverts: 0,
  };
  for (const c of commits) {
    t.authors.add(c.author);
    const prefix = prefixOf(c.subject);
    if (prefix) bump(t.prefixes, prefix);
    if (/^(fix|bugfix|hotfix)\b/.test(prefix)) t.fixes += 1;
    if (prefix.startsWith("revert")) t.reverts += 1;
    for (const f of c.files) bump(t.paths, f);
    countPairs(c.files, t.pairs);
  }
  return t;
}

/** Pure analysis of parsed commits. `min` is the occurrence count that makes a pattern a candidate. */
export function analyse(commits, min = 3) {
  const t = tally(commits);
  const dates = commits.map((c) => c.date).sort((x, y) => x.localeCompare(y));
  return {
    commits: commits.length,
    authors: t.authors.size,
    from: dates[0] ?? null,
    to: dates.at(-1) ?? null,
    fixShare: commits.length === 0 ? 0 : Math.round((t.fixes / commits.length) * 100) / 100,
    reverts: t.reverts,
    repeatedPrefixes: top(t.prefixes, min, 10).map(([prefix, count]) => ({ prefix, count })),
    hotPaths: top(t.paths, min, 10).map(([file, count]) => ({ file, count })),
    changedTogether: top(t.pairs, min, 10).map(([pair, count]) => ({ pair, count })),
  };
}

const namesIn = (dir, keep) => (existsSync(dir) ? readdirSync(dir).filter(keep).sort() : []);

/** The automation that already exists, by name only, so a proposal does not duplicate it. */
export function mechanisms(cwd) {
  return {
    workflows: namesIn(path.join(cwd, ".github/workflows"), (n) => /\.ya?ml$/.test(n)),
    workerJobs: namesIn(path.join(cwd, "ops/worker/jobs"), (n) => n.endsWith(".json")),
    opsAreas: namesIn(path.join(cwd, "ops"), (n) => /^[\w-]+$/.test(n)),
    deployScripts: namesIn(path.join(cwd, "infrastructure/deployment"), (n) => n.endsWith(".sh")),
  };
}

export function collect({ cwd = process.cwd(), since = "30 days ago", min = 3 } = {}) {
  if (!validSince(since)) throw new Error('since must look like "30 days ago" or 2026-10-01');
  const out = execFileSync(
    GIT,
    ["log", `--since=${since}`, "--no-merges", "--format=@%H|%aI|%an|%s", "--name-only"],
    { cwd, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
  );
  return { ...analyse(parseLog(out), min), mechanisms: mechanisms(cwd) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = (name, fallback) => {
    const i = process.argv.indexOf(name);
    return i >= 0 ? process.argv[i + 1] : fallback;
  };
  try {
    const min = Number(arg("--min", "3"));
    if (!Number.isInteger(min) || min < 1) throw new Error("--min must be a positive integer");
    const result = collect({ since: arg("--since", "30 days ago"), min });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    console.error(String(error.message));
    process.exit(2);
  }
}
