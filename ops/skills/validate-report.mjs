#!/usr/bin/env node
// Usage: validate-report.mjs end|czujka <file|->. `-` reads the report from stdin, so a read-only
// session can check its own output without writing a file. Exit 0 when the shape is right.
import { readFileSync } from "node:fs";
import { validateCzujkaReport, validateEndReport } from "./lib.mjs";

const [kind, file] = process.argv.slice(2);
const validators = { end: validateEndReport, czujka: validateCzujkaReport };
if (!Object.hasOwn(validators, kind ?? "") || !file) {
  console.error("usage: validate-report.mjs end|czujka <file|->");
  process.exit(2);
}
const problems = validators[kind](readFileSync(file === "-" ? 0 : file, "utf8"));
for (const p of problems) console.error(`- ${p}`);
console.log(problems.length === 0 ? "ok" : `${problems.length} problem(s)`);
process.exit(problems.length === 0 ? 0 : 1);
