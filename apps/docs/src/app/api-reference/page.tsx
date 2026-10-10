import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "API Reference",
  description: "Every NEXORA API v1 endpoint.",
};

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "https://api.onenexora.com";

export default function ApiReferencePage() {
  return (
    <article className="prose prose-invert max-w-none">
      <h1>API Reference</h1>
      <p>
        Base URL: <code>{apiUrl}</code>. Every endpoint below is under <code>/v1</code>.
      </p>

      <h2>Authentication</h2>
      <p>
        Send your API key as a bearer token on every request except <code>/v1/health</code>:
      </p>
      <pre>
        <code>Authorization: Bearer nx_live_...</code>
      </pre>
      <p>
        Get a key from <strong>Console → API Keys</strong> — see the{" "}
        <a href="/quickstart">Quickstart</a>.
      </p>

      <h2>Errors</h2>
      <p>Every error, from every endpoint, has this shape:</p>
      <pre>
        <code>{`{
  "error": {
    "code": "invalid_api_key",
    "message": "This API key is invalid or has been revoked.",
    "request_id": "b3c1..."
  }
}`}</code>
      </pre>
      <table>
        <thead>
          <tr>
            <th>Status</th>
            <th>Code</th>
            <th>Meaning</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>401</td>
            <td>
              <code>missing_api_key</code>
            </td>
            <td>No Authorization header, or not a Bearer token.</td>
          </tr>
          <tr>
            <td>401</td>
            <td>
              <code>invalid_api_key</code>
            </td>
            <td>The key doesn&rsquo;t exist or has been revoked.</td>
          </tr>
          <tr>
            <td>403</td>
            <td>
              <code>insufficient_scope</code>
            </td>
            <td>
              The key lacks a scope the endpoint needs (see <a href="#neurawall">NeuraWall</a>).
            </td>
          </tr>
          <tr>
            <td>404</td>
            <td>
              <code>product_not_found</code>
            </td>
            <td>No public product with that slug.</td>
          </tr>
          <tr>
            <td>429</td>
            <td>
              <code>rate_limited</code>
            </td>
            <td>
              Over the limit — see <a href="/limits">Limits</a>.
            </td>
          </tr>
        </tbody>
      </table>

      <h2 id="products">Products</h2>

      <h3>
        <code>GET /v1/products</code>
      </h3>
      <p>Every public product in the registry.</p>
      <pre>
        <code>{`{
  "data": [
    {
      "id": "prod_sentinel",
      "slug": "sentinel",
      "name": "AI Cloud Log Sentinel",
      "tagline": "AI-assisted log monitoring for cloud environments.",
      "category": "security",
      "platform_pillar": "security",
      "lifecycle": "concept",
      "url": "https://sentinel.onenexora.com"
    }
  ]
}`}</code>
      </pre>

      <h3>
        <code>GET /v1/products/:slug</code>
      </h3>
      <p>One product, with its full description. 404 if not public.</p>
      <pre>
        <code>{`{
  "data": {
    "id": "prod_sentinel",
    "slug": "sentinel",
    "name": "AI Cloud Log Sentinel",
    "tagline": "AI-assisted log monitoring for cloud environments.",
    "description": "Sentinel watches cloud telemetry ...",
    "category": "security",
    "platform_pillar": "security",
    "lifecycle": "concept",
    "url": "https://sentinel.onenexora.com"
  }
}`}</code>
      </pre>

      <h2 id="neurawall">NeuraWall</h2>
      <p>
        For a NeuraWall installation linked to your organisation. Both endpoints need an API key
        created with <strong>Allow linking a NeuraWall installation</strong> in Console, which
        carries the <code>neurawall:link</code> scope. The organisation is always the key&rsquo;s
        own; there is no organisation parameter.
      </p>

      <h3>
        <code>GET /v1/entitlements/neurawall</code>
      </h3>
      <p>
        The plan your organisation is on for NeuraWall. <code>plan_id</code> is already resolved: a
        lapsed, unpaid or suspended subscription is <code>community</code>.{" "}
        <code>current_period_end</code> is epoch seconds, or <code>null</code>. Not cached.
      </p>
      <pre>
        <code>{`{ "org_id": "org_2abc", "plan_id": "business", "current_period_end": 1793491200 }`}</code>
      </pre>

      <h3>
        <code>POST /v1/events</code>
      </h3>
      <p>
        Usage events from the installation, shown in Console&rsquo;s Usage feed. At most 100 events
        and 256 KB per request. Idempotent on <code>event_id</code>, so a retry is safe. The
        contract is closed: only the event types and fields below are accepted, and anything else
        (an address, an email, an unknown field) is rejected with 422.
      </p>
      <pre>
        <code>{`{
  "events": [
    {
      "event_id": "0b8f2c3e-5a41-4d0e-9f0b-1c2d3e4f5a6b",
      "type": "neurawall.alert.created",
      "ts": 1793000000.5,
      "data": { "severity": "high" }
    }
  ]
}

200 { "stored": 1, "duplicates": 0 }`}</code>
      </pre>
      <table>
        <thead>
          <tr>
            <th>Type</th>
            <th>
              <code>data</code>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>neurawall.alert.created</code>
            </td>
            <td>
              <code>severity</code>: low, medium, high, critical
            </td>
          </tr>
          <tr>
            <td>
              <code>neurawall.rule.approved</code>
            </td>
            <td>
              <code>mode</code>: enforce, alert_only
            </td>
          </tr>
          <tr>
            <td>
              <code>neurawall.bundle.published</code>
            </td>
            <td>
              <code>version</code>, <code>rules</code> (integers)
            </td>
          </tr>
          <tr>
            <td>
              <code>neurawall.bundle.rolled_back</code>
            </td>
            <td>
              <code>version</code>
            </td>
          </tr>
          <tr>
            <td>
              <code>neurawall.node.enrolled</code>, <code>neurawall.node.revoked</code>
            </td>
            <td>none</td>
          </tr>
          <tr>
            <td>
              <code>neurawall.llm.call</code>
            </td>
            <td>
              <code>kind</code>: triage, draft, narrate, explain; <code>outcome</code>: ok, refused,
              error
            </td>
          </tr>
          <tr>
            <td>
              <code>neurawall.flows.ingested</code>
            </td>
            <td>
              <code>count</code> (integer)
            </td>
          </tr>
        </tbody>
      </table>

      <h2>Health</h2>
      <h3>
        <code>GET /v1/health</code>
      </h3>
      <p>No authentication required.</p>
      <pre>
        <code>{`{ "status": "ok", "time": "2026-09-22T12:00:00.000Z" }`}</code>
      </pre>
    </article>
  );
}
