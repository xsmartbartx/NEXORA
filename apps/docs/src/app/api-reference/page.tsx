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
