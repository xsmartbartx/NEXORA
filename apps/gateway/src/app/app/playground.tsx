"use client";

import { Button } from "@nexora/ui";
import { useState, useTransition } from "react";
import { runPlaygroundChat } from "./actions";

export function Playground() {
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    setResponse(null);
    startTransition(async () => {
      try {
        const result = await runPlaygroundChat(formData);
        setResponse(result.text);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Request failed.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <form action={handleSubmit} className="flex flex-col gap-3">
        <textarea
          name="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          placeholder="Ask something…"
          className="w-full rounded-md border border-input bg-transparent p-3 text-sm outline-none focus:border-primary"
        />
        <div>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Sending…" : "Send"}
          </Button>
        </div>
      </form>

      {error ? (
        <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
          {error}
        </div>
      ) : null}

      {response ? (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Response
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm">{response}</p>
        </div>
      ) : null}
    </div>
  );
}
