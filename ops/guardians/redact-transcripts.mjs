#!/usr/bin/env node
// Removes secret-shaped values from Claude Code session transcripts (*.jsonl).
//
// Transcripts are context that was sent to a model, so any key that appeared in one has to be
// rotated at its provider; this tool is the second half of that job: it takes the leftover copies
// out of the files on disk. It does NOT make a leaked key safe: rotate first.
//
//   node ops/guardians/redact-transcripts.mjs                 dry run: counts only, changes nothing
//   node ops/guardians/redact-transcripts.mjs --apply         rewrites the files in place
//   node ops/guardians/redact-transcripts.mjs --dir <path>    default: ~/.claude/projects
//
// It never prints a matched value, only file names and counts. A replaced value becomes
// "[redacted]", which keeps every JSON line valid. Files changed in the last 10 minutes are
// skipped (a running session is appending to them); symlinks are not followed.

import { lstatSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { redact } from "../costsec/policy.mjs";

const ACTIVE_WINDOW_MS = 10 * 60 * 1000;
const MAX_DEPTH = 6;
// Shapes the shared redactor does not cover (it already handles GitHub, Stripe, webhook and test keys).
const EXTRA = [
  /\bsk-ant-[\w-]{20,}/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bAIza[\w-]{35}\b/g,
  /\bxox[abprs]-[\w-]{10,}/g,
];

/** Redacted text and how many values were replaced. */
export function redactText(text) {
  let count = 0;
  const bump = (match) => {
    count += 1;
    return match;
  };
  let out = text;
  for (const shape of EXTRA) out = out.replace(shape, (m) => (bump(m), "[redacted]"));
  const shared = redact(out);
  // The shared redactor does not report a count; count what it removed from what is left.
  const before = (out.match(/\[redacted\]/g) ?? []).length;
  const after = (shared.match(/\[redacted\]/g) ?? []).length;
  return { text: shared, count: count + (after - before) };
}

function* walk(dir, depth = 0) {
  if (depth > MAX_DEPTH) return;
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const info = lstatSync(full);
    if (info.isSymbolicLink()) continue;
    if (info.isDirectory()) yield* walk(full, depth + 1);
    else if (info.isFile() && name.endsWith(".jsonl")) yield { full, info };
  }
}

/** Scans (and with apply, rewrites) a folder. Returns per-file results; never contains a value. */
export function run(dir, { apply = false, now = Date.now() } = {}) {
  const files = [];
  for (const { full, info } of walk(dir)) {
    if (now - info.mtimeMs < ACTIVE_WINDOW_MS) {
      files.push({ file: full, count: 0, skipped: "modified in the last 10 minutes" });
      continue;
    }
    const { text, count } = redactText(readFileSync(full, "utf8"));
    if (count > 0 && apply) {
      const tmp = `${full}.redacting`;
      writeFileSync(tmp, text, { mode: info.mode & 0o777 });
      renameSync(tmp, full);
    }
    files.push({ file: full, count, skipped: null });
  }
  return files;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const at = args.indexOf("--dir");
  const dir = at >= 0 ? args[at + 1] : path.join(homedir(), ".claude", "projects");
  if (!dir) {
    console.error("--dir needs a path");
    process.exit(2);
  }
  const results = run(dir, { apply });
  for (const r of results.filter((x) => x.count > 0 || x.skipped)) {
    console.log(
      `${r.count}\t${r.skipped ? `skipped (${r.skipped})` : apply ? "redacted" : "found"}\t${r.file}`,
    );
  }
  const total = results.reduce((sum, r) => sum + r.count, 0);
  const files = results.filter((r) => r.count > 0).length;
  console.log(
    `${total} value(s) in ${files} file(s) of ${results.length} scanned${apply ? ", rewritten" : " (dry run, nothing changed; add --apply)"}`,
  );
}
