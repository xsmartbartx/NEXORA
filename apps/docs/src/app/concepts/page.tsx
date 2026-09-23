import type { Metadata } from "next";

const websiteUrl = process.env.NEXT_PUBLIC_WEBSITE_URL ?? "https://onenexora.com";

export const metadata: Metadata = {
  title: "Concepts",
  description: "The platform model every NEXORA API and product shares.",
};

export default function ConceptsPage() {
  return (
    <article className="prose prose-invert max-w-none">
      <h1>Concepts</h1>
      <p>
        Five ideas explain almost everything about how NEXORA is built. Understanding them tells you
        why the API and console behave the way they do.
      </p>

      <h2>Organisations, not individual accounts</h2>
      <p>
        Products, API keys and billing all belong to an <strong>organisation</strong>, never to a
        person directly. A person can belong to more than one organisation and switches between them
        explicitly. This is why creating an API key in the console asks you to pick an organisation
        first — the key inherits that organisation&rsquo;s scope for its entire lifetime.
      </p>

      <h2>The Product Registry</h2>
      <p>
        Every NEXORA product — regardless of whether it has shipped any code yet — is one record in
        a single registry. The website&rsquo;s homepage, the <code>/products</code> page, the
        console&rsquo;s product tiles, the sitemap and{" "}
        <a href="/api-reference#products">the API&rsquo;s product endpoints</a> all read the same
        records. A product&rsquo;s <code>lifecycle</code> field — <code>concept</code>,{" "}
        <code>alpha</code>, <code>beta</code>, <code>production</code> — controls where it appears:
        only <code>beta</code> and later show up publicly.
      </p>

      <h2>Machine identity is separate from user identity</h2>
      <p>
        Signing in to the console proves who <em>you</em> are, via session cookies. Calling the API
        proves what <em>organisation</em> is calling, via an API key — a long-lived secret,
        generated once, hashed at rest, and never tied to a specific person&rsquo;s session.
        Revoking your own console session does not revoke your organisation&rsquo;s API keys, and
        vice versa.
      </p>

      <h2>The Marketplace taxonomy</h2>
      <p>
        A Product is one specific thing: a full NEXORA app with a subdomain, a lifecycle and a
        Tenant Contract to satisfy. Not everything worth listing is that heavy — an API surface,
        an integration with an external provider, or eventually an agent, model or tool doesn&rsquo;t
        need its own subdomain to be real. The{" "}
        <a href={`${websiteUrl}/marketplace`}>marketplace</a> lists both: Products under
        &ldquo;Apps&rdquo;, and
        everything else as a <code>MarketplaceListing</code> with a <code>kind</code> of{" "}
        <code>api</code>, <code>agent</code>, <code>model</code>, <code>integration</code> or{" "}
        <code>tool</code>. A kind with nothing in it yet is shown as an honest empty state, not
        hidden — adding the first real listing in it is a data change, not a schema rewrite.
      </p>

      <h2>Everything is versioned and reversible</h2>
      <p>
        The API is versioned in the URL (<code>/v1/...</code>). A breaking change ships as{" "}
        <code>/v2</code> with a stated deprecation window for <code>/v1</code> — existing
        integrations are never broken without warning.
      </p>
    </article>
  );
}
