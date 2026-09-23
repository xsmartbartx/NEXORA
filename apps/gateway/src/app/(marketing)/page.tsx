import { Badge, buttonVariants } from "@nexora/ui";

const docsUrl = process.env.NEXT_PUBLIC_DOCS_URL ?? "https://docs.onenexora.com";
const statusUrl = process.env.NEXT_PUBLIC_STATUS_URL ?? "https://status.onenexora.com";

const steps = [
  {
    title: "Key",
    body: "Use the same NEXORA API key your org already has — no separate Gateway key.",
  },
  {
    title: "Call",
    body: "POST to /v1/chat with a messages array, same shape as a normal chat completion.",
  },
  {
    title: "Govern",
    body: "Every call is authenticated, rate-limited, entitlement-checked and logged.",
  },
];

const capabilities = [
  "One upstream provider today, proxied with your org's own key never exposed to the caller",
  "Every call authenticated, rate-limited and entitlement-checked the same way as every other NEXORA endpoint",
  "Usage logged to your organisation's Console → Usage view",
  "A live playground in Console to try it without writing code first",
];

export default function GatewayHome() {
  return (
    <>
      <section className="flex flex-col items-center px-6 py-24 text-center">
        <Badge variant="brand">Beta</Badge>
        <h1 className="mt-4 max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Secure AI Gateway
        </h1>
        <p className="mt-4 max-w-xl text-lg text-muted-foreground">
          A governed front door for every model call your org makes. One key, one endpoint, full
          audit trail — instead of a loose API key copy-pasted into every service that needs a
          model.
        </p>
        <div className="mt-8 flex flex-col gap-4 sm:flex-row">
          <a href="/app" className={buttonVariants({ size: "lg" })}>
            Open Gateway
          </a>
          <a
            href={`${docsUrl}/quickstart`}
            className={buttonVariants({ size: "lg", variant: "outline" })}
          >
            Read the docs
          </a>
        </div>
      </section>

      <section className="border-t border-border px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-2xl font-semibold tracking-tight">Key. Call. Govern.</h2>
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

      <section className="border-t border-border px-6 py-20">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-xl font-semibold">What&rsquo;s real today</h2>
          <ul className="mt-4 flex flex-col gap-2">
            {capabilities.map((c) => (
              <li key={c} className="flex gap-2 text-sm text-muted-foreground">
                <span className="text-primary">→</span>
                {c}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-muted-foreground">
            One configurable upstream provider today; multi-provider routing and a model policy
            engine are on the roadmap — see{" "}
            <a href={`${docsUrl}/concepts`} className="text-primary hover:underline">
              Concepts
            </a>
            .
          </p>
        </div>
      </section>

      <section className="border-t border-border px-6 py-8 text-center">
        <a href={statusUrl} className="text-sm text-muted-foreground hover:text-foreground">
          Check platform status →
        </a>
      </section>
    </>
  );
}
