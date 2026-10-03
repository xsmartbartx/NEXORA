import type { Metadata } from "next";

const statusUrl = process.env.NEXT_PUBLIC_STATUS_URL ?? "https://status.onenexora.com";
const websiteUrl = process.env.NEXT_PUBLIC_WEBSITE_URL ?? "https://onenexora.com";

export const metadata: Metadata = {
  title: "Operations",
  description: "Status, incidents, support and what to expect operationally during beta.",
};

export default function OperationsDocsPage() {
  return (
    <article className="prose prose-invert max-w-none">
      <h1>Operations</h1>
      <p>What to expect from running NEXORA in production while the products are in beta.</p>

      <h2 id="status">Status</h2>
      <p>
        <a href={statusUrl}>{statusUrl}</a> probes each platform component, product and piece of
        infrastructure live (results refresh every 30 seconds) and lists incidents and planned
        maintenance. Check it first if something looks wrong.
      </p>

      <h2 id="rate-limits">Rate limits</h2>
      <p>
        API requests are rate limited per key. When you exceed a limit the API returns{" "}
        <code>429</code> with error code <code>rate_limited</code>; wait until the time given by the{" "}
        <code>X-RateLimit-Reset</code> header before retrying. Plan quotas are covered under{" "}
        <a href="/limits">Limits</a>.
      </p>

      <h2 id="availability">Availability</h2>
      <p>
        There is no uptime SLA during beta. The platform runs in a single region on one server, with
        nightly database backups (kept 14 days) and weekly full-server backups (kept 27 days). Plan
        for occasional short interruptions during deployments.
      </p>

      <h2 id="support">Support</h2>
      <p>
        Email <code>hello@onenexora.com</code>. For security issues use{" "}
        <code>security@onenexora.com</code> instead — see <a href="/security">Security</a>.
      </p>

      <h2 id="changes">Changes</h2>
      <p>
        Every shipped change is listed in the <a href="/changelog">changelog</a>, and the website
        carries the platform-wide <a href={`${websiteUrl}/changelog`}>release history</a>.
      </p>
    </article>
  );
}
