import type { Metadata } from "next";
import { requireOrg } from "@nexora/auth/server";
import { ApiKeyManager } from "./api-key-manager";
import { listApiKeys } from "./actions";

export const metadata: Metadata = {
  title: "API Keys",
};

export default async function ApiKeysPage() {
  await requireOrg();

  let keys;
  let dbError: string | null = null;
  try {
    keys = await listApiKeys();
  } catch {
    // DATABASE_URL is a placeholder until a real Postgres instance is wired
    // up (see the root README) — fail this one page gracefully, not the app.
    dbError =
      "Database not reachable. Set DATABASE_URL to a real Postgres instance to manage keys.";
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        Console
      </span>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">API Keys</h1>
      <p className="mt-2 max-w-xl text-muted-foreground">
        Machine identity for your organisation (§6.4). Keys are hashed at rest and shown in full
        exactly once, at creation.
      </p>

      <div className="mt-8">
        {dbError ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            {dbError}
          </div>
        ) : (
          <ApiKeyManager initialKeys={keys ?? []} />
        )}
      </div>
    </div>
  );
}
