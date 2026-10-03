import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@nexora/ui";

export const metadata: Metadata = {
  title: "Security Architecture",
  description:
    "How NEXORA is built and hosted today: request path, tenant isolation, secrets, backups and what is not yet in place.",
};

const layers = [
  {
    name: "Edge",
    detail:
      "A Caddy reverse proxy terminates TLS (Let's Encrypt certificates, HTTP redirected to HTTPS) and routes each hostname to its app.",
  },
  {
    name: "Applications",
    detail:
      "Website, Account, Console, API, Docs, Status, Developers, Sentinel, CSPM and Gateway run as separate containers, each built from the same monorepo and shared Core packages.",
  },
  {
    name: "Identity",
    detail:
      "Sign-in, sessions and organisations are handled by Clerk. NEXORA stores no passwords. Machine access uses per-organisation API keys, stored only as hashes.",
  },
  {
    name: "Data",
    detail:
      "PostgreSQL holds subscriptions, API key hashes and audit events. Redis holds rate-limit counters only, never customer data.",
  },
  {
    name: "Payments",
    detail:
      "Stripe-hosted checkout. Card data never reaches NEXORA; billing webhooks are accepted only after signature verification.",
  },
  {
    name: "Observability",
    detail:
      "Sentry for application errors, Prometheus and Grafana for host, Postgres and Redis metrics, with alerting on database/cache outages, memory and disk.",
  },
];

const controls = [
  {
    title: "Tenant isolation",
    body: "Every organisation-scoped query filters by organisation inside the query itself, and an automated cross-organisation check verifies one organisation's events, keys and subscriptions never appear in another's.",
  },
  {
    title: "API authentication",
    body: "API keys are generated once, shown once and stored as one-way hashes. Revoking a key takes effect immediately. Requests are rate limited per key using shared Redis counters, so limits hold across replicas.",
  },
  {
    title: "Secrets",
    body: "Production secrets live in environment files on the server, outside the repository. Secret scanning and push protection are enabled on the code repository.",
  },
  {
    title: "Code and dependency scanning",
    body: "CodeQL analysis and Dependabot run on the repository; every change builds and type-checks in CI before it can merge.",
  },
  {
    title: "Audit trail",
    body: "API key changes, product usage and admin product-access changes are recorded with actor, organisation, outcome and timestamp, and shown to the organisation in Console.",
  },
  {
    title: "Backups",
    body: "Database backed up nightly (kept 14 days) and the whole server weekly (kept 27 days), within the same Oracle Cloud region.",
  },
];

const gaps = [
  "No independent penetration test or third-party security audit yet.",
  "No SOC 2, ISO 27001 or other formal certification.",
  "Single-region, single-server hosting: no automatic failover, and backups are not replicated to a second region.",
  "No public-facing SLA while products are in beta.",
];

export default function SecurityArchitecturePage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-20">
      <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        Security
      </span>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">Security architecture</h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">
        A high-level view of how NEXORA is built and hosted today. It describes what is actually in
        place, including the gaps, and omits details that would help an attacker.
      </p>

      <h2 className="mt-12 text-xl font-semibold">Request path and components</h2>
      <p className="mt-2 font-mono text-sm text-muted-foreground">
        Browser / API client &rarr; TLS reverse proxy &rarr; application container &rarr; Postgres
        &middot; Redis &middot; Clerk &middot; Stripe
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {layers.map((layer) => (
          <Card key={layer.name}>
            <h3 className="font-semibold">{layer.name}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{layer.detail}</p>
          </Card>
        ))}
      </div>

      <h2 className="mt-12 text-xl font-semibold">Controls</h2>
      <dl className="mt-4 flex flex-col gap-5">
        {controls.map((control) => (
          <div key={control.title}>
            <dt className="font-medium">{control.title}</dt>
            <dd className="mt-1 text-sm text-muted-foreground">{control.body}</dd>
          </div>
        ))}
      </dl>

      <h2 className="mt-12 text-xl font-semibold">Not yet in place</h2>
      <ul className="mt-4 list-disc pl-5 text-sm text-muted-foreground">
        {gaps.map((gap) => (
          <li key={gap} className="mt-1">
            {gap}
          </li>
        ))}
      </ul>

      <p className="mt-12 text-sm text-muted-foreground">
        See the{" "}
        <Link href="/legal/security" className="text-link hover:underline">
          Security Statement
        </Link>{" "}
        for the vulnerability-reporting policy, or the live{" "}
        <a href="https://status.onenexora.com" className="text-link hover:underline">
          status page
        </a>
        .
      </p>
    </div>
  );
}
