"use client";

import { Badge, Button, type BadgeVariant } from "@nexora/ui";
import { useState, useTransition } from "react";
import { runAnalysis } from "./actions";
import type { AnalyzeResult, FindingSeverity } from "@/lib/analyze";

const severityVariant: Record<FindingSeverity, BadgeVariant> = {
  critical: "warning",
  warning: "brand",
  info: "neutral",
};

const SAMPLE = `2026-09-22T10:00:01Z INFO  request completed in 42ms
2026-09-22T10:00:02Z INFO  request completed in 39ms
2026-09-22T10:00:03Z INFO  request completed in 51ms
2026-09-22T10:00:04Z ERROR connection refused to payments-db
2026-09-22T10:00:05Z INFO  request completed in 45ms
2026-09-22T10:00:06Z INFO  request completed in 40ms
2026-09-22T10:00:07Z FATAL out of memory in worker pool
2026-09-22T10:00:08Z INFO  request completed in 43ms`;

export function LogAnalyzer() {
  const [logs, setLogs] = useState("");
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        setResult(await runAnalysis(formData));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Analysis failed.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <form action={handleSubmit} className="flex flex-col gap-3">
        <textarea
          name="logs"
          value={logs}
          onChange={(e) => setLogs(e.target.value)}
          rows={10}
          placeholder="Paste log lines, one per line…"
          className="w-full rounded-md border border-input bg-transparent p-3 font-mono text-sm outline-none focus:border-primary"
        />
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Analyzing…" : "Analyze"}
          </Button>
          <button
            type="button"
            className="text-sm text-muted-foreground hover:text-foreground"
            onClick={() => setLogs(SAMPLE)}
          >
            Use sample data
          </button>
        </div>
      </form>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {result ? (
        <div>
          <p className="text-sm text-muted-foreground">
            {result.totalLines} lines analyzed — {result.findings.length} flagged.
          </p>
          <div className="mt-4 flex flex-col divide-y divide-border rounded-xl border border-border">
            {result.findings.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">
                Nothing stood out — every line fit an expected pattern.
              </p>
            ) : (
              result.findings.map((finding) => (
                <div key={finding.lineNumber} className="flex flex-col gap-1 p-4">
                  <div className="flex items-center gap-2">
                    <Badge variant={severityVariant[finding.severity]}>{finding.severity}</Badge>
                    <span className="text-xs text-muted-foreground">
                      Line {finding.lineNumber} — {finding.reason}
                    </span>
                  </div>
                  <code className="break-all font-mono text-sm">{finding.line}</code>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
