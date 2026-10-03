import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SDKs & CLI",
  description: "OpenAPI spec and TypeScript client for the NEXORA API.",
};

export default function SdksPage() {
  return (
    <article className="prose prose-invert max-w-none">
      <h1>SDKs &amp; CLI</h1>
      <p>
        What exists today: a machine-readable <strong>OpenAPI 3.1 spec</strong> and a small{" "}
        <strong>TypeScript client</strong>. The CLI is not built yet.
      </p>

      <h2 id="openapi">OpenAPI spec</h2>
      <p>
        The spec is served at <code>https://api.onenexora.com/openapi.json</code> and covers every
        public <code>/v1</code> endpoint (webhooks excluded). A test in the repository fails if a
        route is added or removed without the spec being updated, so it cannot silently drift. Feed
        it to any OpenAPI generator to produce a client in your language.
      </p>

      <h2 id="typescript">TypeScript client</h2>
      <p>
        <code>@nexora/sdk</code> lives in the NEXORA monorepo (<code>packages/sdk</code>). It is not
        published to npm yet, so for now copy the single file or wait for the first release. It has
        no dependencies beyond <code>fetch</code>.
      </p>
      <pre>
        <code>{`import { NexoraClient, NexoraApiError } from "@nexora/sdk";

const nexora = new NexoraClient({ apiKey: process.env.NEXORA_API_KEY! });

const { data: products, rateLimit } = await nexora.listProducts();
const { data: sentinel } = await nexora.getProduct("sentinel");

try {
  await nexora.getProduct("missing");
} catch (error) {
  if (error instanceof NexoraApiError) {
    console.log(error.status, error.code, error.requestId);
  }
}`}</code>
      </pre>
      <ul>
        <li>Typed responses and one error class carrying the status, code and request ID.</li>
        <li>
          Every result includes the <code>X-RateLimit-*</code> values; retry on <code>429</code> is
          left to the caller for now.
        </li>
      </ul>

      <h2>CLI — planned, not built</h2>
      <pre>
        <code>{`nexora login
nexora products list
nexora products get sentinel
nexora keys create --name "CI pipeline"`}</code>
      </pre>
      <p>
        A thin wrapper over the TypeScript client, not a second implementation — it would exist for
        scripting and CI, not as the primary integration path.
      </p>

      <h2>Other languages</h2>
      <p>
        Not planned until a customer asks. The API is plain JSON over HTTPS with bearer-token auth,
        so any language can call it directly today — see the{" "}
        <a href="/api-reference">API Reference</a>.
      </p>
    </article>
  );
}
