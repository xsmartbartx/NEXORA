import { Badge, buttonVariants } from "@nexora/ui";

const docsUrl = process.env.NEXT_PUBLIC_DOCS_URL ?? "https://docs.onenexora.com";
const statusUrl = process.env.NEXT_PUBLIC_STATUS_URL ?? "https://status.onenexora.com";

const steps = [
  { title: "Describe", body: "List your resources as JSON — buckets, security groups, IAM policies." },
  { title: "Scan", body: "A real rule set checks each resource against known misconfiguration patterns." },
  { title: "Fix", body: "Get back concrete findings, ranked by severity, with what to change." },
];

const capabilities = [
  "S3 buckets: public read access, missing encryption",
  "Security groups: ingress open to 0.0.0.0/0, sensitive ports flagged separately",
  "IAM policies: wildcard actions and resources",
  "Databases: public accessibility, missing encryption",
  "Usage logged to your organisation's Console → Usage view",
];

export default function CspmHome() {
  return (
    <>
      <section className="flex flex-col items-center px-6 py-24 text-center">
        <Badge variant="brand">Beta</Badge>
        <h1 className="mt-4 max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          NEXORA CSPM
        </h1>
        <p className="mt-4 max-w-xl text-lg text-muted-foreground">
          Paste your cloud config, get real findings back. The same class of
          check a live-connected scanner runs — public buckets, open
          security groups, over-permissive policies — on a resource
          description you provide.
        </p>
        <div className="mt-8 flex flex-col gap-4 sm:flex-row">
          <a href="/app" className={buttonVariants({ size: "lg" })}>
            Open CSPM
          </a>
          <a href={`${docsUrl}/quickstart`} className={buttonVariants({ size: "lg", variant: "outline" })}>
            Read the docs
          </a>
        </div>
      </section>

      <section className="border-t border-border px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-2xl font-semibold tracking-tight">Describe. Scan. Fix.</h2>
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
            Rule-based checks on data you provide today; connecting a live
            cloud account is on the roadmap — see{" "}
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
