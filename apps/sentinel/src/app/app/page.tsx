import { requireOrg } from "@nexora/auth/server";
import { LogAnalyzer } from "./log-analyzer";

const consoleUrl = process.env.NEXT_PUBLIC_CONSOLE_URL ?? "https://console.onenexora.com";

export default async function SentinelAppPage() {
  await requireOrg({ chooseOrgUrl: `${consoleUrl}/select-organization` });

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        Sentinel
      </span>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Analyze a log sample</h1>
      <p className="mt-2 max-w-xl text-muted-foreground">
        Paste log lines below. Nothing is stored — analysis is stateless.
      </p>
      <div className="mt-8">
        <LogAnalyzer />
      </div>
    </div>
  );
}
