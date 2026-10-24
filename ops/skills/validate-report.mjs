#!/usr/bin/env node
// Usage: validate-report.mjs end|czujka|plan|review|cto <file|->. `-` reads the report from stdin, so a read-only
// session can check its own output without writing a file. Exit 0 when the shape is right.
import { readFileSync } from "node:fs";
import { validateCzujkaReport, validateEndReport } from "./lib.mjs";
import { validateCtoCard, validateReviewReport, validateTeamPlan } from "./lib-team.mjs";

const [kind, file] = process.argv.slice(2);
const planFrom = (text) => {
  let plan;
  try {
    plan = JSON.parse(text);
  } catch {
    return ["the plan is not valid JSON"];
  }
  return validateTeamPlan(plan);
};
const validators = {
  end: validateEndReport,
  czujka: validateCzujkaReport,
  plan: planFrom,
  review: validateReviewReport,
  cto: validateCtoCard,
};
if (!Object.hasOwn(validators, kind ?? "") || !file) {
  console.error("usage: validate-report.mjs end|czujka|plan|review|cto <file|->");
  process.exit(2);
}
const problems = validators[kind](readFileSync(file === "-" ? 0 : file, "utf8"));
for (const p of problems) console.error(`- ${p}`);
console.log(problems.length === 0 ? "ok" : `${problems.length} problem(s)`);
process.exit(problems.length === 0 ? 0 : 1);
