import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Quickstart",
  description: "Get an API key and make your first NEXORA API call.",
};

const consoleUrl = process.env.NEXT_PUBLIC_CONSOLE_URL ?? "https://console.onenexora.com";
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "https://api.onenexora.com";

export default function QuickstartPage() {
  return (
    <article className="prose prose-invert max-w-none">
      <h1>Quickstart</h1>
      <p>Two steps: get a key, make a call.</p>

      <h2>1. Get an API key</h2>
      <ol>
        <li>
          Sign in at{" "}
          <a href={consoleUrl} target="_blank" rel="noopener noreferrer">
            {consoleUrl}
          </a>{" "}
          and select or create an organisation — every key belongs to an organisation, not to you
          personally.
        </li>
        <li>
          Open <strong>API Keys</strong> in the sidebar, name the key, and create it.
        </li>
        <li>
          Copy the key immediately. It is shown in full exactly once and stored hashed — NEXORA
          cannot show it to you again.
        </li>
      </ol>

      <h2>2. Make your first call</h2>
      <p>
        List every public NEXORA product — this is the same Product Registry that drives the
        website&rsquo;s <code>/products</code> page:
      </p>
      <pre>
        <code>{`curl ${apiUrl}/v1/products \\
  -H "Authorization: Bearer nx_live_your_key_here"`}</code>
      </pre>

      <p>
        A successful response today looks like this — empty, because no product has graduated past{" "}
        <code>concept</code>/<code>alpha</code> yet (the same reason <code>/products</code> on the
        website is empty too):
      </p>
      <pre>
        <code>{`{ "data": [] }`}</code>
      </pre>
      <p>
        Once a product reaches <code>beta</code>, it shows up here with this shape:
      </p>
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
      "lifecycle": "beta",
      "url": "https://sentinel.onenexora.com"
    }
  ]
}`}</code>
      </pre>

      <p>
        Either way, the call succeeded if you got a <code>200</code> back — that confirms your key
        and organisation are real. Every response — success or error — carries{" "}
        <code>X-RateLimit-Limit</code>, <code>X-RateLimit-Remaining</code> and{" "}
        <code>X-RateLimit-Reset</code> headers. See <a href="/limits">Limits</a> for the numbers and{" "}
        <a href="/api-reference">API Reference</a> for every endpoint.
      </p>

      <h2>No key yet, just exploring?</h2>
      <p>
        <code>GET /v1/health</code> needs no authentication:
      </p>
      <pre>
        <code>{`curl ${apiUrl}/v1/health`}</code>
      </pre>
    </article>
  );
}
