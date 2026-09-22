import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SDKs & CLI",
  description: "The planned shape of the NEXORA SDK and CLI — not yet built.",
};

export default function SdksPage() {
  return (
    <article className="prose prose-invert max-w-none">
      <h1>SDKs &amp; CLI</h1>
      <p>
        <strong>Specification only — nothing on this page is built yet.</strong>{" "}
        The API is small enough today (three endpoints) that a raw{" "}
        <code>fetch</code> or <code>curl</code> call, as shown in the{" "}
        <a href="/quickstart">Quickstart</a>, is the right tool. This page
        exists so the shape is decided before the surface grows, per §14
        (Phase 3) of the architecture document.
      </p>

      <h2>When to build it</h2>
      <p>
        A generated SDK earns its cost once the API has enough endpoints
        that hand-written <code>fetch</code> calls become repetitive and
        error-prone across consumers — realistically once product endpoints
        exist alongside the registry ones (Phase 4+), not before.
      </p>

      <h2>TypeScript SDK — planned shape</h2>
      <p>
        Generated from the API&rsquo;s route handlers via an OpenAPI schema,
        not hand-maintained — the fastest way for the SDK to drift out of
        sync with the real API is a human keeping it up to date by hand.
      </p>
      <pre>
        <code>{`import { Nexora } from "@nexora/sdk";

const nexora = new Nexora({ apiKey: process.env.NEXORA_API_KEY });

const products = await nexora.products.list();
const sentinel = await nexora.products.get("sentinel");`}</code>
      </pre>
      <ul>
        <li>Typed request/response shapes generated from the same schema as the API Reference.</li>
        <li>Automatic retry with backoff on <code>429</code>, honouring <code>X-RateLimit-Reset</code>.</li>
        <li>One package, published from this monorepo once the API stabilises past <code>/v1</code>.</li>
      </ul>

      <h2>CLI — planned shape</h2>
      <pre>
        <code>{`nexora login
nexora products list
nexora products get sentinel
nexora keys create --name "CI pipeline"`}</code>
      </pre>
      <p>
        A thin wrapper over the TypeScript SDK, not a second implementation —
        it exists for scripting and CI, not as the primary integration path.
      </p>

      <h2>Other languages</h2>
      <p>
        Not planned until a customer asks. The API is plain JSON over HTTPS
        with bearer-token auth, so any language can call it directly today —
        see the <a href="/api-reference">API Reference</a>.
      </p>
    </article>
  );
}
