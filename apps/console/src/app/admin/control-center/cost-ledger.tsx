"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@nexora/ui";
import { addCostAction, endCostAction } from "./actions";
import { money } from "./format";

export interface CostRow {
  id: string;
  vendor: string;
  label: string;
  amountCents: number;
  interval: string;
}

const field =
  "rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground";

export function CostLedger({ entries }: { entries: CostRow[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await addCostAction(formData);
      if (result.error) setError(result.error);
      else formRef.current?.reset();
    });
  }

  return (
    <div>
      <form ref={formRef} action={submit} className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Vendor
          <input
            name="vendor"
            required
            maxLength={60}
            placeholder="Oracle Cloud"
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          What for (optional)
          <input name="label" maxLength={120} placeholder="nexora-platform VM" className={field} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Amount (USD)
          <input
            name="amount"
            required
            inputMode="decimal"
            placeholder="25.00"
            className={`${field} w-28`}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Per
          <select name="interval" defaultValue="month" className={field}>
            <option value="month">month</option>
            <option value="year">year</option>
          </select>
        </label>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Saving…" : "Add cost"}
        </Button>
      </form>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {entries.length > 0 ? (
        <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
            >
              <span>
                <span className="font-medium">{entry.vendor}</span>
                {entry.label ? (
                  <span className="text-muted-foreground"> — {entry.label}</span>
                ) : null}
              </span>
              <span className="flex items-center gap-4">
                <span className="font-mono">
                  {money(entry.amountCents)}
                  <span className="text-muted-foreground"> / {entry.interval}</span>
                </span>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => startTransition(() => endCostAction(entry.id))}
                  className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:opacity-50"
                >
                  End
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
