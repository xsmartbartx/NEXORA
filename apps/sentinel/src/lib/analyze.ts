/**
 * The real analysis engine behind Sentinel today: keyword rules plus
 * frequency-based outlier detection on a normalized "shape" of each line.
 * No trained model, no external AI call — deliberately, so every result is
 * verifiable and every run is free. Deeper AI-based analysis (an LLM call
 * behind a provider API key) is a natural extension of this same interface
 * later, not a rewrite.
 */

export type FindingSeverity = "info" | "warning" | "critical";

export interface LogFinding {
  line: string;
  lineNumber: number;
  severity: FindingSeverity;
  reason: string;
}

export interface AnalyzeResult {
  totalLines: number;
  findings: LogFinding[];
}

const KEYWORD_RULES: { pattern: RegExp; severity: FindingSeverity; reason: string }[] = [
  {
    pattern: /\b(fatal|panic|segfault|out of memory|oom)\b/i,
    severity: "critical",
    reason: "Fatal-level keyword",
  },
  {
    pattern: /\b(error|exception|denied|refused|failed)\b/i,
    severity: "warning",
    reason: "Error-level keyword",
  },
  {
    pattern: /\b(timeout|retry|retrying|degraded|slow)\b/i,
    severity: "info",
    reason: "Reliability keyword",
  },
];

const MAX_FINDINGS = 100;

/** Collapses the variable parts of a line so repeated log shapes collide into one bucket. */
function normalizeShape(line: string): string {
  return line
    .replace(
      /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g,
      "<uuid>",
    )
    .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, "<ip>")
    .replace(/\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d+)?Z?\b/g, "<timestamp>")
    .replace(/\b\d+\b/g, "<n>")
    .trim()
    .slice(0, 100);
}

export function analyzeLogSample(raw: string): AnalyzeResult {
  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const shapes = lines.map(normalizeShape);
  const frequency = new Map<string, number>();
  for (const shape of shapes) frequency.set(shape, (frequency.get(shape) ?? 0) + 1);

  const rarityThreshold = Math.max(1, Math.floor(lines.length * 0.02));
  const findings: LogFinding[] = [];

  for (let i = 0; i < lines.length && findings.length < MAX_FINDINGS; i++) {
    const line = lines[i]!;
    const keywordRule = KEYWORD_RULES.find((rule) => rule.pattern.test(line));

    if (keywordRule) {
      findings.push({
        line,
        lineNumber: i + 1,
        severity: keywordRule.severity,
        reason: keywordRule.reason,
      });
      continue;
    }

    const count = frequency.get(shapes[i]!) ?? 0;
    if (lines.length >= 10 && count <= rarityThreshold) {
      findings.push({
        line,
        lineNumber: i + 1,
        severity: "info",
        reason: `Rare pattern — seen ${count} time${count === 1 ? "" : "s"} in ${lines.length} lines`,
      });
    }
  }

  return { totalLines: lines.length, findings };
}
