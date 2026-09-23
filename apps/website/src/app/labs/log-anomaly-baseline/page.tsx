import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Log anomaly detection: a statistical baseline",
  description:
    "How Sentinel flags anomalous log lines without a trained model — keyword rules plus frequency-based outlier detection.",
};

export default function LogAnomalyBaselinePage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-20">
      <Link href="/labs" className="text-sm text-muted-foreground hover:text-foreground">
        &larr; Labs
      </Link>

      <span className="mt-4 block font-mono text-xs uppercase tracking-widest text-muted-foreground">
        Research
      </span>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
        Log anomaly detection: a statistical baseline
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">2026-09-23</p>

      <div className="mt-8 flex flex-col gap-4 text-foreground/90">
        <p>
          Sentinel&rsquo;s job is to take ten thousand log lines and hand back the ten worth
          reading. The obvious approach — a trained model — needs training data nobody has for a
          brand-new product, and an inference cost on every request. Here&rsquo;s the baseline that
          ships instead: two techniques, both explainable, both free to run.
        </p>

        <h2 className="mt-4 text-xl font-semibold text-foreground">1. Keyword rules</h2>
        <p>
          Some lines are noteworthy regardless of how often they repeat.{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">fatal</code>,{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">panic</code> and{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">out of memory</code>{" "}
          are always worth a look, even if the same fatal error happens on every line. Three
          severity tiers — fatal, error, reliability — catch these before frequency ever gets
          consulted.
        </p>

        <h2 className="mt-4 text-xl font-semibold text-foreground">2. Frequency-based outliers</h2>
        <p>
          Most of what&rsquo;s actually interesting isn&rsquo;t a known keyword — it&rsquo;s a line
          that just doesn&rsquo;t look like the others. The approach:
        </p>
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            <strong>Normalize each line&rsquo;s &ldquo;shape&rdquo;</strong> — replace timestamps,
            IPs, UUIDs and numbers with placeholders, so{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
              request completed in 42ms
            </code>{" "}
            and{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
              request completed in 51ms
            </code>{" "}
            collapse to the same bucket instead of counting as two different lines.
          </li>
          <li>
            <strong>Count each shape&rsquo;s frequency</strong> across the whole sample.
          </li>
          <li>
            <strong>Flag shapes below a rarity threshold</strong> — 2% of the sample, so it scales
            with volume instead of using a fixed count that&rsquo;s meaningless on both a 50-line
            and a 50,000-line sample.
          </li>
        </ol>

        <pre className="mt-2 overflow-x-auto rounded-xl border border-border bg-card p-4 text-sm">
          <code>{`function normalizeShape(line: string): string {
  return line
    .replace(UUID_PATTERN, "<uuid>")
    .replace(IP_PATTERN, "<ip>")
    .replace(TIMESTAMP_PATTERN, "<timestamp>")
    .replace(/\\b\\d+\\b/g, "<n>")
    .trim();
}`}</code>
        </pre>

        <h2 className="mt-4 text-xl font-semibold text-foreground">
          What this catches, and what it doesn&rsquo;t
        </h2>
        <p>
          It catches: known-bad keywords regardless of volume, and any line shape that&rsquo;s
          genuinely rare in the sample — a one-off stack trace, an unusual diagnostic dump, a
          request pattern that only happened once. It doesn&rsquo;t catch: an anomaly that happens
          to share a shape with common traffic (a slow request logged in exactly the same format as
          a fast one), or anything that needs semantic understanding of what the log actually means.
          That gap is exactly where a real model earns its cost later — this baseline is the floor,
          not the ceiling.
        </p>

        <p className="mt-4">
          The real, unit-tested implementation is{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">
            apps/sentinel/src/lib/analyze.ts
          </code>{" "}
          in the NEXORA monorepo — this write-up describes what actually ships, not a simplified
          version of it.
        </p>
      </div>
    </div>
  );
}
