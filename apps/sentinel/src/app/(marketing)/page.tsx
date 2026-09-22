import { Badge, buttonVariants } from "@nexora/ui";

const docsUrl = process.env.NEXT_PUBLIC_DOCS_URL ?? "https://docs.onenexora.com";
const statusUrl = process.env.NEXT_PUBLIC_STATUS_URL ?? "https://status.onenexora.com";

const steps = [
  { title: "Paste", body: "Drop in a log sample — plain text, one entry per line." },
  { title: "Analyze", body: "Keyword rules plus frequency-based outlier detection run instantly." },
  { title: "Review", body: "Get back the lines actually worth a human's attention, ranked by severity." },
];

const capabilities = [
  "Keyword rules for fatal/error/reliability-class log lines",
  "Frequency-based outlier detection — the shapes that barely repeat",
  "No log storage: analysis is stateless, nothing is retained after the response",
  "Usage logged to your organisation's Console → Usage view",
];

export default function SentinelHome() {
  return (
    <>
      <section className="flex flex-col items-center px-6 py-24 text-center">
        <Badge variant="brand">Beta</Badge>
        <h1 className="mt-4 max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          AI Cloud Log Sentinel
        </h1>
        <p className="mt-4 max-w-xl text-lg text-muted-foreground">
          Paste a log sample, find the ten lines worth reading. Sentinel
          flags what doesn&rsquo;t fit the pattern, so you don&rsquo;t read
          ten thousand lines to find the ones that matter.
        </p>
        <div className="mt-8 flex flex-col gap-4 sm:flex-row">
          <a href="/app" className={buttonVariants({ size: "lg" })}>
            Open Sentinel
          </a>
          <a href={`${docsUrl}/quickstart`} className={buttonVariants({ size: "lg", variant: "outline" })}>
            Read the docs
          </a>
        </div>
      </section>

      <section className="border-t border-border px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-2xl font-semibold tracking-tight">Paste. Analyze. Review.</h2>
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
            Statistical detection today; deeper AI-based analysis and live
            cloud log connections are on the roadmap — see{" "}
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
