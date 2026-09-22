import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Limits",
  description: "Rate limits and other constraints on the NEXORA API.",
};

export default function LimitsPage() {
  return (
    <article className="prose prose-invert max-w-none">
      <h1>Limits</h1>

      <h2>Rate limiting</h2>
      <p>
        <strong>60 requests per minute per API key</strong>, fixed window. Every response carries
        these headers so you can self-throttle before hitting <code>429</code>:
      </p>
      <table>
        <thead>
          <tr>
            <th>Header</th>
            <th>Meaning</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>X-RateLimit-Limit</code>
            </td>
            <td>Requests allowed per window (60).</td>
          </tr>
          <tr>
            <td>
              <code>X-RateLimit-Remaining</code>
            </td>
            <td>Requests left in the current window.</td>
          </tr>
          <tr>
            <td>
              <code>X-RateLimit-Reset</code>
            </td>
            <td>Unix timestamp (seconds) when the window resets.</td>
          </tr>
        </tbody>
      </table>
      <p>
        Exceeding the limit returns <code>429</code> with{" "}
        <code>error.code: &quot;rate_limited&quot;</code>.
      </p>

      <h2>What&rsquo;s not entitlement-gated yet</h2>
      <p>
        Endpoints today read the same public registry data regardless of which organisation is
        calling — there is no per-plan quota beyond the flat rate limit above. Entitlements (limits
        tied to a billing plan) arrive in Phase 5, once there is a product and a plan to attach them
        to.
      </p>

      <h2>API keys</h2>
      <p>
        No hard cap on keys per organisation today. A key has no expiry — revoke it from{" "}
        <strong>Console → API Keys</strong> when it&rsquo;s no longer needed.
      </p>
    </article>
  );
}
