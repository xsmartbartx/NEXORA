import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonVariants, cn } from "@nexora/ui";
import {
  categoryLabels,
  getAllProducts,
  getProductBySlug,
  getProductCapabilities,
  getProductDocSections,
  getProductIntegrations,
  getProductPlans,
  pillarLabels,
} from "@nexora/registry";
import { LifecycleBadge } from "@/components/lifecycle-badge";
import { JsonLd } from "@/components/json-ld";

const docsUrl = process.env.NEXT_PUBLIC_DOCS_URL ?? "https://docs.onenexora.com";

export function generateStaticParams() {
  return getAllProducts().map((product) => ({ slug: product.slug }));
}

export async function generateMetadata(props: PageProps<"/products/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const product = getProductBySlug(slug);
  if (!product) return {};
  return {
    title: product.short_name,
    description: product.tagline,
  };
}

export default async function ProductDetailPage(props: PageProps<"/products/[slug]">) {
  const { slug } = await props.params;
  const product = getProductBySlug(slug);
  if (!product) notFound();

  const isLive = product.lifecycle !== "concept" && product.lifecycle !== "alpha";
  const integrations = getProductIntegrations(product.slug);
  const capabilities = getProductCapabilities(product.slug);
  const plans = getProductPlans(product.slug);
  const docSections = getProductDocSections(product.slug);

  return (
    <div className="mx-auto max-w-3xl px-6 py-20">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: product.name,
          description: product.tagline,
          url: product.url,
          applicationCategory: categoryLabels[product.category],
          ...(product.version ? { softwareVersion: product.version } : {}),
        }}
      />
      <Link href="/products" className="text-sm text-muted-foreground hover:text-foreground">
        &larr; Products
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          {categoryLabels[product.category]} · {pillarLabels[product.platform_pillar]} pillar
        </span>
        <LifecycleBadge lifecycle={product.lifecycle} />
      </div>

      <h1 className="mt-3 text-4xl font-semibold tracking-tight">{product.name}</h1>
      <p className="mt-4 text-lg text-pretty text-muted-foreground">{product.tagline}</p>

      <div className="mt-8 max-w-2xl text-foreground/90">
        <p>{product.description}</p>
      </div>

      {capabilities.length > 0 ? (
        <div className="mt-8">
          <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Capabilities
          </h2>
          <ul className="mt-3 flex flex-col gap-3">
            {capabilities.map((capability) => (
              <li key={capability.label}>
                <p className="font-medium text-foreground">{capability.label}</p>
                <p className="text-sm text-muted-foreground">{capability.description}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {plans.length > 0 ? (
        <div className="mt-8">
          <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Plans
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {plans.map((plan) => (
              <li
                key={plan.name}
                className="rounded-full border border-border px-3 py-1 text-sm text-muted-foreground"
              >
                {plan.name} — {plan.price_reference} · {plan.limits}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {docSections.length > 0 ? (
        <div className="mt-8">
          <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Documentation
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {docSections.map((section) => (
              <li key={section.path}>
                <a href={`${docsUrl}${section.path}`} className="text-sm text-link hover:underline">
                  {section.title} &rarr;
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {integrations.length > 0 ? (
        <div className="mt-8">
          <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Integrates with
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {integrations.map((integration) => {
              const otherSlug =
                integration.product === product.slug
                  ? integration.target_product
                  : integration.product;
              return (
                <li key={`${integration.product}-${integration.target_product}`}>
                  <Link
                    href={`/products/${otherSlug}`}
                    className="rounded-full border border-border px-3 py-1 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                  >
                    {otherSlug}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <div className="mt-10 rounded-xl border border-dashed border-border p-6">
        {isLive ? (
          <>
            <p className="text-sm text-muted-foreground">
              {product.short_name} is live. Visit the product for more.
            </p>
            <a
              href={product.url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ size: "md" }), "mt-4")}
            >
              Open {product.short_name}
            </a>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {product.short_name} is at the{" "}
              <strong className="text-foreground">{product.lifecycle}</strong> stage — in Labs, not
              yet a public release. There is no SLA and no public sign-up yet.
            </p>
            <Link href="/company#contact" className={cn(buttonVariants({ size: "md" }), "mt-4")}>
              Get in touch
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
