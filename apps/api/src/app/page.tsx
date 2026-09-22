import { LogoMark } from "@nexora/ui";

const docsUrl = process.env.NEXT_PUBLIC_DOCS_URL ?? "https://docs.onenexora.com";

export default function ApiRoot() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
      <LogoMark className="h-10 w-10" />
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">NEXORA API</h1>
      <p className="mt-2 max-w-md text-muted-foreground">
        This host serves JSON, not pages. Start at{" "}
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">GET /v1/health</code> or
        read the{" "}
        <a href={`${docsUrl}/quickstart`} className="text-primary hover:underline">
          quickstart
        </a>
        .
      </p>
    </div>
  );
}
