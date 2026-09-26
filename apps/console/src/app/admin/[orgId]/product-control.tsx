"use client";

import { useState, useTransition } from "react";
import { Badge, Button } from "@nexora/ui";
import type { ProductSuspensionInfo, ProductUsage } from "@nexora/admin";
import { resumeProductAction, suspendProductAction } from "./actions";

type Mode = "idle" | "confirm-suspend" | "confirm-resume";

export function ProductControl({
  orgId,
  usage,
  suspension,
}: {
  orgId: string;
  usage: ProductUsage;
  suspension: ProductSuspensionInfo | undefined;
}) {
  const [mode, setMode] = useState<Mode>("idle");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const pct =
    usage.limit === null
      ? null
      : Math.min(100, Math.round((usage.used / Math.max(usage.limit, 1)) * 100));

  function submitSuspend() {
    if (!reason.trim()) {
      setError("A reason is required.");
      return;
    }
    setError(null);
    const formData = new FormData();
    formData.set("reason", reason);
    startTransition(async () => {
      await suspendProductAction(orgId, usage.product.slug, formData);
      setMode("idle");
      setReason("");
    });
  }

  function submitResume() {
    startTransition(async () => {
      await resumeProductAction(orgId, usage.product.slug);
      setMode("idle");
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{usage.product.name}</p>
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">
            {usage.product.features.join(", ")}
          </p>
        </div>
        <Badge variant={usage.suspended ? "warning" : "success"}>
          {usage.suspended ? "suspended" : "active"}
        </Badge>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Usage this period</span>
          <span>
            {usage.used}
            {usage.limit === null ? " (unlimited)" : ` / ${usage.limit}`}
          </span>
        </div>
        {pct !== null ? (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={pct >= 100 ? "h-full bg-warning" : "h-full bg-primary"}
              style={{ width: `${pct}%` }}
            />
          </div>
        ) : null}
      </div>

      {usage.suspended && suspension ? (
        <div className="mt-4 rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm">
          <p className="text-warning">Suspended: {suspension.reason}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            By {suspension.suspendedBy} · {suspension.createdAt.toLocaleString()}
          </p>
        </div>
      ) : null}

      <div className="mt-4">
        {mode === "idle" && !usage.suspended ? (
          <Button variant="secondary" size="sm" onClick={() => setMode("confirm-suspend")}>
            Suspend access…
          </Button>
        ) : null}

        {mode === "idle" && usage.suspended ? (
          <Button variant="secondary" size="sm" onClick={() => setMode("confirm-resume")}>
            Resume access…
          </Button>
        ) : null}

        {mode === "confirm-suspend" ? (
          <div className="flex flex-col gap-2">
            <label
              className="text-sm text-muted-foreground"
              htmlFor={`reason-${usage.product.slug}`}
            >
              Why is {usage.product.name} being suspended for this customer? This is required and is
              not shown to the customer — only that access was suspended.
            </label>
            <textarea
              id={`reason-${usage.product.slug}`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50"
              placeholder="e.g. abuse report under investigation, ticket #1234"
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <div className="flex gap-2">
              <Button variant="destructive" size="sm" onClick={submitSuspend} disabled={isPending}>
                {isPending ? "Suspending…" : "Confirm suspension"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setMode("idle");
                  setReason("");
                  setError(null);
                }}
                disabled={isPending}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : null}

        {mode === "confirm-resume" ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">
              Resume {usage.product.name} for this customer? They&rsquo;ll regain access
              immediately, subject to their plan&rsquo;s normal limits.
            </p>
            <div className="flex gap-2">
              <Button size="sm" onClick={submitResume} disabled={isPending}>
                {isPending ? "Resuming…" : "Confirm resume"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMode("idle")}
                disabled={isPending}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
