import { buttonVariants, cn } from "@nexora/ui";
import {
  getFeaturedProducts,
  getLabsProducts,
  pillarLabels,
  pillarTaglines,
} from "@nexora/registry";
import Link from "next/link";
import { platformPillarSlugs } from "@/lib/nav";
import { ProductCard } from "@/components/product-card";

const developersUrl = process.env.NEXT_PUBLIC_DEVELOPERS_URL ?? "https://developers.onenexora.com";
const docsUrl = process.env.NEXT_PUBLIC_DOCS_URL ?? "https://docs.onenexora.com";
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "https://api.onenexora.com";
const statusUrl = process.env.NEXT_PUBLIC_STATUS_URL ?? "https://status.onenexora.com";

const coreCapabilities = [
  "Identity",
  "Organisations",
  "API",
  "Billing",
  "Telemetry",
  "Security",
  "Infrastructure",
];

const developerSteps = [
  { label: "API", href: apiUrl },
  { label: "Docs", href: docsUrl },
  { label: "Developers", href: developersUrl },
  { label: "GitHub", href: "https://github.com/xsmartbartx/NEXORA" },
];

export default function Home() {
  const featured = getFeaturedProducts();
  const labs = getLabsProducts();

  return (
    <>
      <section className="flex flex-col items-center px-6 py-28 text-center sm:py-36">
        <div className="flex max-w-2xl flex-col items-center gap-8">
          <span className="rounded-full border border-border px-3 py-1 font-mono text-xs uppercase tracking-widest text-muted-foreground">
            AI · Security · Cloud
          </span>

          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
            Build. Secure. Operate.
          </h1>

          <p className="text-lg text-pretty text-muted-foreground sm:text-xl">
            Production software infrastructure for modern AI-powered applications — one account, one
            console, one API surface and one operational backbone underneath every product.
          </p>

          <div className="flex flex-col gap-4 sm:flex-row">
            <Link href="/products" className={buttonVariants({ size: "lg" })}>
              Explore products
            </Link>
            <a
              href={developersUrl}
              className={cn(buttonVariants({ size: "lg", variant: "outline" }))}
            >
              Developers
            </a>
          </div>
        </div>
      </section>

      {featured.length > 0 ? (
        <section className="border-t border-border px-6 py-20">
          <div className="mx-auto max-w-6xl">
            <div className="flex items-end justify-between gap-4">
              <h2 className="text-2xl font-semibold tracking-tight">Products</h2>
              <Link href="/products" className="text-sm font-medium text-link hover:underline">
                All products &rarr;
              </Link>
            </div>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        </section>
      ) : labs.length > 0 ? (
        <section className="border-t border-border px-6 py-20">
          <div className="mx-auto max-w-6xl">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">Building in the open</h2>
                <p className="mt-2 max-w-2xl text-muted-foreground">
                  No product has graduated to a public release yet. Here&rsquo;s what is in Labs
                  today.
                </p>
              </div>
              <Link href="/labs" className="text-sm font-medium text-link hover:underline">
                Visit Labs &rarr;
              </Link>
            </div>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {labs.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="border-t border-border px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-semibold tracking-tight">Platform</h2>
            <p className="max-w-2xl text-muted-foreground">
              Every product above is built on the same shared core — not rebuilt from zero each
              time.
            </p>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-3 gap-y-2 font-mono text-sm text-foreground/90">
            {coreCapabilities.map((capability, i) => (
              <span key={capability} className="flex items-center gap-3">
                {capability}
                {i < coreCapabilities.length - 1 ? (
                  <span className="text-muted-foreground" aria-hidden>
                    ·
                  </span>
                ) : null}
              </span>
            ))}
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {platformPillarSlugs.map((pillar) => (
              <Link
                key={pillar}
                href={`/platform/${pillar}`}
                className="group flex flex-col gap-2 rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/50"
              >
                <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
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
      </section>

      <section className="border-t border-border px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-2xl font-semibold tracking-tight">Developers</h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            One API, one set of keys, one place to read how it works.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3 font-mono text-sm">
            {developerSteps.map((step, i) => (
              <span key={step.label} className="flex items-center gap-3">
                <a href={step.href} className="text-link hover:underline">
                  {step.label}
                </a>
                {i < developerSteps.length - 1 ? (
                  <span className="text-muted-foreground" aria-hidden>
                    &rarr;
                  </span>
                ) : null}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-2xl font-semibold tracking-tight">Trust</h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            What NEXORA actually does today, stated plainly — not a compliance badge wall.
          </p>
          <div className="mt-8 flex flex-wrap gap-6">
            <Link href="/legal/security" className="text-sm font-medium text-link hover:underline">
              Security Statement &rarr;
            </Link>
            <a href={statusUrl} className="text-sm font-medium text-link hover:underline">
              System Status &rarr;
            </a>
          </div>
        </div>
      </section>

      <section className="border-t border-border px-6 py-20">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
          <h2 className="text-2xl font-semibold tracking-tight">
            The platform first, the product second.
          </h2>
          <p className="text-muted-foreground">
            Once NEXORA Core exists, every new product inherits authentication, accounts, billing,
            API keys and navigation on day one — instead of rebuilding them from zero.
          </p>
          <Link href="/company#contact" className={buttonVariants({ size: "lg" })}>
            Talk to us
          </Link>
        </div>
      </section>
    </>
  );
}
