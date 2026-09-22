"use client";

import { Badge, Button, buttonVariants, cn } from "@nexora/ui";
import { useState, useTransition } from "react";
import { createApiKey, revokeApiKey, type ApiKeySummary } from "./actions";

export function ApiKeyManager({ initialKeys }: { initialKeys: ApiKeySummary[] }) {
  const [keys, setKeys] = useState(initialKeys);
  const [revealedKey, setRevealedKey] = useState<{ key: string; name: string } | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCreate(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await createApiKey(formData);
        setRevealedKey({ key: result.key, name: result.name });
        setKeys((prev) => [
          {
            id: result.keyPrefix,
            name: result.name,
            keyPrefix: result.keyPrefix,
            createdAt: new Date().toISOString(),
            lastUsedAt: null,
            revokedAt: null,
          },
          ...prev,
        ]);
        setName("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not create key");
      }
    });
  }

  function handleRevoke(id: string) {
    startTransition(async () => {
      await revokeApiKey(id);
      setKeys((prev) => prev.map((k) => (k.id === id ? { ...k, revokedAt: new Date().toISOString() } : k)));
    });
  }

  return (
    <div className="flex flex-col gap-8">
      {revealedKey ? (
        <div className="rounded-xl border border-warning/40 bg-warning/10 p-4">
          <p className="text-sm font-medium text-warning">
            Copy &ldquo;{revealedKey.name}&rdquo; now — it won&rsquo;t be shown again.
          </p>
          <code className="mt-2 block break-all rounded-md bg-background/60 px-3 py-2 font-mono text-sm">
            {revealedKey.key}
          </code>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className={buttonVariants({ size: "sm", variant: "outline" })}
              onClick={() => navigator.clipboard.writeText(revealedKey.key)}
            >
              Copy
            </button>
            <button
              type="button"
              className={buttonVariants({ size: "sm", variant: "ghost" })}
              onClick={() => setRevealedKey(null)}
            >
              I&rsquo;ve saved it
            </button>
          </div>
        </div>
      ) : null}

      <form
        action={handleCreate}
        className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-end"
      >
        <div className="flex-1">
          <label htmlFor="key-name" className="text-sm font-medium">
            Name
          </label>
          <input
            id="key-name"
            name="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. CI pipeline"
            className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Creating…" : "Create key"}
        </Button>
      </form>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex flex-col divide-y divide-border rounded-xl border border-border">
        {keys.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No API keys yet.</p>
        ) : (
          keys.map((key) => (
            <div key={key.id} className="flex items-center justify-between gap-4 p-4">
              <div>
                <p className={cn("font-medium", key.revokedAt && "text-muted-foreground line-through")}>
                  {key.name}
                </p>
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">{key.keyPrefix}</p>
              </div>
              {key.revokedAt ? (
                <Badge variant="neutral">Revoked</Badge>
              ) : (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleRevoke(key.id)}
                  className="text-sm text-destructive hover:underline"
                >
                  Revoke
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
