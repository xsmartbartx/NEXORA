import { requireOrg } from "@nexora/auth/server";
import { isUpstreamConfigured } from "@/lib/relay";
import { Playground } from "./playground";

const consoleUrl = process.env.NEXT_PUBLIC_CONSOLE_URL ?? "https://console.onenexora.com";

export default async function GatewayAppPage() {
  await requireOrg({ chooseOrgUrl: `${consoleUrl}/select-organization` });

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        Gateway
      </span>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Playground</h1>
      <p className="mt-2 max-w-xl text-muted-foreground">
        Try a call through Gateway using your organisation&rsquo;s own session — no API key needed
        here. For real integrations, call{" "}
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">POST /v1/chat</code> with
        an API key from Console.
      </p>

      {isUpstreamConfigured() ? (
        <div className="mt-8">
          <Playground />
        </div>
      ) : (
        <div className="mt-8 rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          No upstream provider configured yet. Set GATEWAY_UPSTREAM_API_KEY to enable the playground
          and /v1/chat.
        </div>
      )}
    </div>
  );
}
