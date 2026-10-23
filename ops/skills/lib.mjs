// Format checks for the End and Czujka reports. Deterministic, so "the report has the right shape"
// is a test and not a hope. See ops/skills/end/SKILL.md and ops/skills/czujka/SKILL.md.

const wordCount = (text) => text.split(/\s+/).filter(Boolean).length;
const MAX_SUMMARY_WORDS = 300;
const MAX_IMPROVEMENTS = 3;
const END_FIELDS = ["Metric", "Baseline", "Target", "Measurement"];
const CZUJKA_FIELDS = ["Source", "Frequency", "Estimated saving", "Risk"];

/** Splits a markdown string on "### " headings: [{ title, body }]. */
function blocks(section) {
  return section
    .split(/^### /m)
    .slice(1)
    .map((chunk) => {
      const [title, ...rest] = chunk.split("\n");
      return { title: title.trim(), body: rest.join("\n") };
    });
}

const hasField = (body, name) => {
  const line = body.split("\n").find((l) => l.trimStart().startsWith(`- ${name}:`));
  return Boolean(line && line.slice(line.indexOf(":") + 1).trim().length > 0);
};

function missingFields(items, fields, label) {
  const problems = [];
  for (const item of items) {
    for (const f of fields) {
      if (!hasField(item.body, f)) problems.push(`${label} "${item.title}": missing ${f}`);
    }
  }
  return problems;
}

/** @returns {string[]} problems; empty means the report has the required shape. */
export function validateEndReport(text) {
  const problems = [];
  const summaryAt = text.indexOf("## Summary");
  const improvementsAt = text.indexOf("## Improvements");
  if (summaryAt < 0) problems.push("missing the ## Summary section");
  if (improvementsAt < 0) problems.push("missing the ## Improvements section");
  if (problems.length > 0) return problems;
  if (summaryAt > improvementsAt) return ["## Summary must come before ## Improvements"];
  const summary = text.slice(summaryAt + "## Summary".length, improvementsAt);
  if (wordCount(summary) === 0) return ["the summary is empty"];
  const words = wordCount(summary);
  if (words >= MAX_SUMMARY_WORDS)
    problems.push(`summary has ${words} words, the limit is under ${MAX_SUMMARY_WORDS}`);
  const section = text.slice(improvementsAt + "## Improvements".length);
  const items = blocks(section);
  if (items.length > MAX_IMPROVEMENTS)
    problems.push(`${items.length} improvements, the limit is ${MAX_IMPROVEMENTS}`);
  if (items.length === 0 && !/no improvement proposed/i.test(section)) {
    problems.push('no improvements and no "No improvement proposed" line');
  }
  return [...problems, ...missingFields(items, END_FIELDS, "improvement")];
}

/** @returns {string[]} */
export function validateCzujkaReport(text) {
  const items = blocks(text);
  if (items.length === 0 && !/too thin|no proposal/i.test(text)) {
    return [
      'no proposals and no statement that the data was too thin ("too thin" / "no proposal")',
    ];
  }
  return missingFields(items, CZUJKA_FIELDS, "proposal");
}
