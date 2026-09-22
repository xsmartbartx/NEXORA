import type { Metadata } from "next";
import Link from "next/link";
import { pillarLabels, pillarTaglines } from "@nexora/registry";
import { platformPillarSlugs } from "@/lib/nav";

export const metadata: Metadata = {
  title: "Platform",
  description:
    "NEXORA Core is the shared identity, registry, entitlements, billing and telemetry layer every product is built on.",
};

const coreServices = [
  { name: "Identity", detail: "Authentication, sessions, MFA and SSO across every subdomain." },
  { name: "Organisations", detail: "Tenancy, membership, roles and invitations." },
  { name: "Product Registry", detail: "The catalogue every public surface renders from." },
  { name: "Entitlements", detail: "What an organisation is allowed to use, and how much." },
  {
    name: "Billing",
    detail: "Subscriptions and invoices, feeding entitlements — never deciding access directly.",
  },
  { name: "API Keys", detail: "Machine identity: scoped, rotatable, revocable." },
  { name: "Telemetry", detail: "Usage counters, audit log, health signals." },
];

export default function PlatformPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-20">
      <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        The NEXORA Platform
      </span>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance">
        One account, one console, one API surface.
      </h1>
      <p className="mt-6 max-w-2xl text-lg text-pretty text-muted-foreground">
        A standalone product adds one unit of value. A platform adds one unit of value <em>and</em>{" "}
        reduces the cost of every product that follows. NEXORA Core exists so a new product inherits
        identity, billing, navigation and observability on day one, instead of rebuilding them.
      </p>

      <div className="mt-16">
        <h2 className="text-xl font-semibold">Three pillars</h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-3">
          {platformPillarSlugs.map((pillar) => (
            <Link
              key={pillar}
              href={`/platform/${pillar}`}
              className="group flex flex-col gap-2 rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/50"
            >
              <span className="font-mono text-xs uppercase tracking-widest text-primary">
                {pillarLabels[pillar]}
              </span>
              <p className="text-sm text-muted-foreground">{pillarTaglines[pillar]}</p>
              <span className="mt-2 text-sm font-medium text-foreground group-hover:text-primary">
                Explore &rarr;
              </span>
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-16">
        <h2 className="text-xl font-semibold">NEXORA Core</h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Core is small, stable and shared. It is the reason the platform is a platform rather than
          a portfolio of unrelated apps.
        </p>
        <dl className="mt-6 grid gap-x-8 gap-y-6 sm:grid-cols-2">
          {coreServices.map((service) => (
            <div key={service.name} className="border-l-2 border-border pl-4">
              <dt className="font-medium text-foreground">{service.name}</dt>
              <dd className="mt-1 text-sm text-muted-foreground">{service.detail}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
