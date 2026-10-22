#!/usr/bin/env node
// Czujka's only data source: metadata from git history. It reads commit subjects (reduced to a
// short prefix), dates, authors counted, and the NAMES of changed files. It never reads a file's
// contents or a diff. Output is JSON on stdout.
//
//   node ops/skills/czujka-metadata.mjs [--since "30 days ago"] [--min 3]

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { redact } from "../costsec/policy.mjs";

const GIT = "/usr/bin/git";
const BULK_COMMIT_FILES = 30; // a commit touching more files than this says nothing about co-change
const SINCE = /^\d{1,3} (?:days?|weeks?|months?) ago$|^\d{4}-\d{2}-\d{2}$/;

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

/** Pure analysis of parsed commits. `min` is the occurrence count that makes a pattern a candidate. */
export function analyse(commits, min = 3) {
  const prefixes = new Map();
  const paths = new Map();
  const pairs = new Map();
  const authors = new Set();
  let fixes = 0;
  let reverts = 0;
  for (const c of commits) {
    authors.add(c.author);
    const prefix = prefixOf(c.subject);
    if (prefix) bump(prefixes, prefix);
    if (/^(fix|bugfix|hotfix)\b/.test(prefix)) fixes += 1;
    if (/^revert\b/.test(prefix)) reverts += 1;
    for (const f of c.files) bump(paths, f);
    if (c.files.length > 1 && c.files.length <= BULK_COMMIT_FILES) {
      const sorted = [...c.files].sort();
      for (let i = 0; i < sorted.length; i += 1) {
        for (let j = i + 1; j < sorted.length; j += 1) bump(pairs, `${sorted[i]} + ${sorted[j]}`);
      }
    }
  }
  const dates = commits.map((c) => c.date).sort();
  return {
    commits: commits.length,
    authors: authors.size,
    from: dates[0] ?? null,
    to: dates.at(-1) ?? null,
    fixShare: commits.length === 0 ? 0 : Math.round((fixes / commits.length) * 100) / 100,
    reverts,
    repeatedPrefixes: top(prefixes, min, 10).map(([prefix, count]) => ({ prefix, count })),
    hotPaths: top(paths, min, 10).map(([file, count]) => ({ file, count })),
    changedTogether: top(pairs, min, 10).map(([pair, count]) => ({ pair, count })),
  };
}

export function collect({ cwd = process.cwd(), since = "30 days ago", min = 3 } = {}) {
  if (!SINCE.test(since)) throw new Error('since must look like "30 days ago" or 2026-10-01');
  const out = execFileSync(
    GIT,
    ["log", `--since=${since}`, "--no-merges", "--format=@%H|%aI|%an|%s", "--name-only"],
    { cwd, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
  );
  return analyse(parseLog(out), min);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = (name, fallback) => {
    const i = process.argv.indexOf(name);
    return i >= 0 ? process.argv[i + 1] : fallback;
  };
  try {
    const result = collect({
      since: arg("--since", "30 days ago"),
      min: Number(arg("--min", "3")),
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    console.error(String(error.message));
    process.exit(2);
  }
}
