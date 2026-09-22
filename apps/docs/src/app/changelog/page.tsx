import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Changelog",
  description: "Platform-wide release notes.",
};

const entries = [
  {
    version: "v1",
    date: "Phase 3",
    changes: [
      "API launched: GET /v1/health, GET /v1/products, GET /v1/products/:slug.",
      "API keys (from Console) authenticate every endpoint except /v1/health.",
      "60 requests/minute per key, enforced with X-RateLimit-* headers on every response.",
      "This docs site.",
    ],
  },
];

export default function ChangelogPage() {
  return (
    <article className="prose prose-invert max-w-none">
      <h1>Changelog</h1>
      <p>
        Platform-wide only — a product&rsquo;s own changelog lives with that
        product once it has one.
      </p>
      {entries.map((entry) => (
        <section key={entry.version}>
          <h2>
            {entry.version} <span className="text-muted-foreground">— {entry.date}</span>
          </h2>
          <ul>
            {entry.changes.map((change) => (
              <li key={change}>{change}</li>
            ))}
          </ul>
        </section>
      ))}
    </article>
  );
}
