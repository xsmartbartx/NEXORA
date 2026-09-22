"use client";

import { Badge, Button, type BadgeVariant } from "@nexora/ui";
import { useState, useTransition } from "react";
import { runScan } from "./actions";
import type { FindingSeverity, ScanResult } from "@/lib/scan";

const severityVariant: Record<FindingSeverity, BadgeVariant> = {
  critical: "warning",
  warning: "brand",
  info: "neutral",
};

const SAMPLE = `{
  "resources": [
    { "type": "s3_bucket", "name": "customer-uploads", "public_read": true, "encrypted": false },
    { "type": "security_group", "name": "web-sg", "ingress": [{ "port": 22, "cidr": "0.0.0.0/0" }] },
    { "type": "iam_policy", "name": "ci-deploy-policy", "actions": ["*"], "resources": ["*"] },
    { "type": "database", "name": "primary-postgres", "publicly_accessible": false, "encrypted": true }
  ]
}`;

export function ConfigScanner() {
  const [resources, setResources] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        setResult(await runScan(formData));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Scan failed.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <form action={handleSubmit} className="flex flex-col gap-3">
        <textarea
          name="resources"
          value={resources}
          onChange={(e) => setResources(e.target.value)}
          rows={12}
          placeholder='{ "resources": [ { "type": "s3_bucket", "name": "...", ... } ] }'
          className="w-full rounded-md border border-input bg-transparent p-3 font-mono text-sm outline-none focus:border-primary"
        />
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Scanning…" : "Scan"}
          </Button>
          <button
            type="button"
            className="text-sm text-muted-foreground hover:text-foreground"
            onClick={() => setResources(SAMPLE)}
          >
            Use sample data
          </button>
        </div>
      </form>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {result ? (
        <div>
          <p className="text-sm text-muted-foreground">
            {result.totalResources} resources scanned — {result.findings.length} finding
            {result.findings.length === 1 ? "" : "s"}.
          </p>
          <div className="mt-4 flex flex-col divide-y divide-border rounded-xl border border-border">
            {result.findings.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">
                No findings — every resource passed the current rule set.
              </p>
            ) : (
              result.findings.map((finding, i) => (
                <div key={`${finding.resource}-${finding.rule}-${i}`} className="flex flex-col gap-1 p-4">
                  <div className="flex items-center gap-2">
                    <Badge variant={severityVariant[finding.severity]}>{finding.severity}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {finding.type} · {finding.resource} · {finding.rule}
                    </span>
                  </div>
                  <p className="text-sm">{finding.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
