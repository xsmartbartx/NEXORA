import { requireOrg } from "@nexora/auth/server";
import { ConfigScanner } from "./config-scanner";

const consoleUrl = process.env.NEXT_PUBLIC_CONSOLE_URL ?? "https://console.onenexora.com";

export default async function CspmAppPage() {
  await requireOrg({ chooseOrgUrl: `${consoleUrl}/select-organization` });

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        CSPM
      </span>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Scan a resource description</h1>
      <p className="mt-2 max-w-xl text-muted-foreground">
        Paste a JSON description of your resources below. Nothing is stored.
      </p>
      <div className="mt-8">
        <ConfigScanner />
      </div>
    </div>
  );
}
