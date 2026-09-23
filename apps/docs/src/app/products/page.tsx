import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Products",
  description: "Per-product quickstarts.",
};

const sentinelUrl = process.env.NEXT_PUBLIC_SENTINEL_URL ?? "https://sentinel.onenexora.com";
const cspmUrl = process.env.NEXT_PUBLIC_CSPM_URL ?? "https://cspm.onenexora.com";
const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "https://gateway.onenexora.com";

export default function ProductsDocsPage() {
  return (
    <article className="prose prose-invert max-w-none">
      <h1>Products</h1>
      <p>
        Each product&rsquo;s own quickstart. All three are <code>beta</code> — real, working tools
        with an honestly-scoped feature set, not the eventual full vision. See each section for
        exactly what that means today.
      </p>

      <h2 id="sentinel">Sentinel</h2>
      <p>
        <a href={sentinelUrl}>{sentinelUrl}</a>
      </p>
      <ol>
        <li>
          Open <a href={`${sentinelUrl}/app`}>{sentinelUrl}/app</a> and sign in — same account as
          everywhere else on NEXORA.
        </li>
        <li>Paste a log sample, one entry per line (or click &ldquo;Use sample data&rdquo;).</li>
        <li>
          Click <strong>Analyze</strong>. You get back the lines that matched a
          fatal/error/reliability keyword, plus lines whose shape barely repeats in your sample.
        </li>
      </ol>
      <p>
        <strong>Today:</strong> keyword rules and frequency-based outlier detection on a sample you
        paste in. Nothing is stored — each analysis is stateless. <strong>Not yet:</strong> live
        cloud log connections, LLM-based analysis.
      </p>

      <h2 id="cspm">CSPM</h2>
      <p>
        <a href={cspmUrl}>{cspmUrl}</a>
      </p>
      <ol>
        <li>
          Open <a href={`${cspmUrl}/app`}>{cspmUrl}/app</a> and sign in.
        </li>
        <li>
          Paste a JSON resource list (or click &ldquo;Use sample data&rdquo;) — see the resource
          shape below.
        </li>
        <li>
          Click <strong>Scan</strong>. You get back findings ranked by severity, each naming the
          resource, the rule, and what&rsquo;s wrong.
        </li>
      </ol>
      <pre>
        <code>{`{
  "resources": [
    { "type": "s3_bucket", "name": "...", "public_read": true, "encrypted": false },
    { "type": "security_group", "name": "...", "ingress": [{ "port": 22, "cidr": "0.0.0.0/0" }] },
    { "type": "iam_policy", "name": "...", "actions": ["*"], "resources": ["*"] },
    { "type": "database", "name": "...", "publicly_accessible": true, "encrypted": false }
  ]
}`}</code>
      </pre>
      <p>
        <strong>Today:</strong> rule-based checks (public buckets, open security groups, wildcard
        IAM policies, public/unencrypted databases) on a resource description you provide. Nothing
        is stored. <strong>Not yet:</strong> connecting a live AWS/GCP/Azure account.
      </p>

      <h2 id="gateway">Gateway</h2>
      <p>
        <a href={gatewayUrl}>{gatewayUrl}</a>
      </p>
      <p>
        Gateway is called via API, not a paste-and-click tool — see{" "}
        <a href="/api-reference">API Reference</a> for the full endpoint. To try it without writing
        code first:
      </p>
      <ol>
        <li>
          Open <a href={`${gatewayUrl}/app`}>{gatewayUrl}/app</a> and sign in.
        </li>
        <li>Type a prompt into the playground and send it — no API key needed here, your session is enough.</li>
      </ol>
      <p>For a real integration, use an API key from Console:</p>
      <pre>
        <code>{`curl ${gatewayUrl}/v1/chat \\
  -H "Authorization: Bearer nx_live_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{"messages":[{"role":"user","content":"Hello"}]}'`}</code>
      </pre>
      <p>
        <strong>Today:</strong> one configurable upstream provider (Anthropic&rsquo;s Messages API
        shape by default), proxied with full auth, rate-limiting, entitlement checks and audit
        logging. <strong>Not yet:</strong> multi-provider routing, a model allowlist/policy engine.
      </p>
    </article>
  );
}
