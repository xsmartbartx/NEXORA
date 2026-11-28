import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getPublicProducts, lifecycleLabels, type Product } from "@nexora/registry";

export const metadata: Metadata = {
  title: "Products",
  description: "Where each NEXORA product lives and how to start with it.",
};

/** True for a docs_url that points back at this page (Gateway's quickstart is here). */
function isThisPage(url: string): boolean {
  const { hostname, pathname } = new URL(url);
  return hostname === "docs.onenexora.com" && pathname === "/products";
}

function productLinks(product: Product): { label: string; href: string }[] {
  const links = [{ label: "Product site", href: product.url }];
  if (product.app_url) links.push({ label: "Open the app", href: product.app_url });
  if (product.docs_url && !isThisPage(product.docs_url)) {
    links.push({ label: "Documentation", href: product.docs_url });
  }
  if (product.api_url) links.push({ label: "API", href: product.api_url });
  if (product.pricing_url) links.push({ label: "Pricing", href: product.pricing_url });
  return links;
}

/**
 * Product-specific quickstart content that is not registry data. Hosts in
 * it still come from the registry record, so they can't drift from it.
 */
const quickstarts: Record<string, (product: Product) => ReactNode> = {
  gateway: (product) =>
    product.api_url ? (
      <>
        <p>
          Gateway is called over HTTP. Create an API key on the API keys page of the Gateway app
          {product.app_url ? (
            <>
              {" "}
              (<a href={`${product.app_url}/keys`}>{`${product.app_url}/keys`}</a>)
            </>
          ) : null}
          , then send requests to <code>{product.api_url}</code>:
        </p>
        <pre>
          <code>{`curl ${product.api_url}/v1/chat \\
  -H "Authorization: Bearer nx_live_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{"messages":[{"role":"user","content":"Hello"}]}'`}</code>
        </pre>
        <p>
          To try it without writing code, open the playground in the app; your session is enough
          there, no API key needed.
        </p>
      </>
    ) : null,
};

export default function ProductsDocsPage() {
  const products = getPublicProducts();

  return (
    <article className="prose prose-invert max-w-none">
      <h1>Products</h1>
      <p>
        Where each product lives and how to start with it. This list comes from the NEXORA Product
        Registry, the same source as the product catalogue on onenexora.com, so its links always
        match the product&rsquo;s real hosts.
      </p>

      {products.map((product) => (
        <section key={product.id}>
          <h2 id={product.slug}>{product.name}</h2>
          <p>
            <strong>{lifecycleLabels[product.lifecycle]}.</strong> {product.tagline}
          </p>
          <ul>
            {productLinks(product).map((link) => (
              <li key={link.label}>
                {link.label}: <a href={link.href}>{link.href}</a>
              </li>
            ))}
          </ul>
          <p>{product.description}</p>
          {quickstarts[product.slug]?.(product)}
        </section>
      ))}
    </article>
  );
}
