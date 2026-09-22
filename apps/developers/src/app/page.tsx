import { buttonVariants } from "@nexora/ui";

const docsUrl = process.env.NEXT_PUBLIC_DOCS_URL ?? "https://docs.onenexora.com";
const consoleUrl = process.env.NEXT_PUBLIC_CONSOLE_URL ?? "https://console.onenexora.com";
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "https://api.onenexora.com";

const steps = [
  {
    title: "Create an organisation",
    body: "Every API key, product and bill belongs to an organisation, not to you personally.",
  },
  {
    title: "Generate an API key",
    body: "From Console → API Keys. Shown once, hashed at rest, revoke it any time.",
  },
  {
    title: "Call the API",
    body: "Plain JSON over HTTPS, bearer-token auth, versioned at /v1 — no SDK required to start.",
  },
];

export default function DevelopersHome() {
  return (
    <>
      <section className="flex flex-col items-center px-6 py-24 text-center">
        <span className="rounded-full border border-border px-3 py-1 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Build on NEXORA
        </span>
        <h1 className="mt-6 max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          One API. One key. Every NEXORA product.
        </h1>
        <p className="mt-4 max-w-xl text-lg text-muted-foreground">
          The same registry that drives the website and console is available as JSON, behind a
          single organisation-scoped API key.
        </p>
        <div className="mt-8 flex flex-col gap-4 sm:flex-row">
          <a href={`${docsUrl}/quickstart`} className={buttonVariants({ size: "lg" })}>
            Read the quickstart
          </a>
          <a href={consoleUrl} className={buttonVariants({ size: "lg", variant: "outline" })}>
            Open Console
          </a>
        </div>
      </section>

      <section className="border-t border-border px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <pre className="overflow-x-auto rounded-xl border border-border bg-card p-6 text-sm">
            <code>{`curl ${apiUrl}/v1/products \\
  -H "Authorization: Bearer nx_live_your_key_here"`}</code>
          </pre>
        </div>
      </section>

      <section className="border-t border-border px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-2xl font-semibold tracking-tight">
            Three steps to a first call
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {steps.map((step, i) => (
              <div key={step.title} className="rounded-xl border border-border bg-card p-6">
                <span className="font-mono text-xs text-primary">0{i + 1}</span>
                <h3 className="mt-2 font-medium">{step.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border px-6 py-20 text-center">
        <h2 className="text-2xl font-semibold tracking-tight">Where to go next</h2>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
          <a href={`${docsUrl}/quickstart`} className="text-primary hover:underline">
            Quickstart →
          </a>
          <a href={`${docsUrl}/api-reference`} className="text-primary hover:underline">
            API Reference →
          </a>
          <a href={`${docsUrl}/concepts`} className="text-primary hover:underline">
            Concepts →
          </a>
          <a href={`${docsUrl}/sdks`} className="text-primary hover:underline">
            SDKs &amp; CLI →
          </a>
        </div>
      </section>
    </>
  );
}
