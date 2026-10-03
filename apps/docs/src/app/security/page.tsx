import type { Metadata } from "next";

const websiteUrl = process.env.NEXT_PUBLIC_WEBSITE_URL ?? "https://onenexora.com";

export const metadata: Metadata = {
  title: "Security",
  description: "How API keys, tenant isolation and vulnerability reporting work on NEXORA.",
};

export default function SecurityDocsPage() {
  return (
    <article className="prose prose-invert max-w-none">
      <h1>Security</h1>
      <p>
        What you can rely on when you integrate with NEXORA, and what you are responsible for. For
        the hosting and infrastructure view, see the{" "}
        <a href={`${websiteUrl}/security/architecture`}>security architecture</a> page.
      </p>

      <h2 id="api-keys">Handling API keys</h2>
      <ul>
        <li>
          A key is shown in full exactly once, at creation. NEXORA stores only a one-way hash, so a
          lost key cannot be recovered — create a new one and revoke the old.
        </li>
        <li>
          Keep keys in your secret manager or CI secrets, never in source control or client-side
          code. A key identifies your <em>organisation</em>, not a person.
        </li>
        <li>Revocation in the console takes effect immediately for new requests.</li>
        <li>Use separate keys per service so one can be revoked without disrupting the others.</li>
      </ul>

      <h2 id="isolation">Tenant isolation</h2>
      <p>
        Every request is scoped to a single organisation. Queries for usage, keys and subscriptions
        filter by organisation at the database query itself, and an automated check confirms one
        organisation&rsquo;s data never appears in another&rsquo;s.
      </p>

      <h2 id="data">Data handling</h2>
      <p>
        Sentinel and CSPM analyses are stateless: the sample or resource description you submit is
        processed and not stored. Audit events record who did what, when and with what outcome,
        never the secret or payload that triggered them. Card details are handled entirely by
        Stripe.
      </p>

      <h2 id="disclosure">Reporting a vulnerability</h2>
      <p>
        Email <code>security@onenexora.com</code>. We aim to acknowledge reports within five
        business days, and do not pursue good-faith research that stays within your own data. A
        machine-readable policy is published at{" "}
        <a href={`${websiteUrl}/.well-known/security.txt`}>/.well-known/security.txt</a>.
      </p>

      <h2 id="limits">Current limitations</h2>
      <p>
        NEXORA has had no independent penetration test and holds no formal certification (SOC 2, ISO
        27001). Hosting is single-region and single-server, and there is no SLA during beta.
      </p>
    </article>
  );
}
