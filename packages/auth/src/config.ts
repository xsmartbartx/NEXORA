/**
 * Deliberately dependency-free (no `@clerk/nextjs` import) so it's safe to
 * use from edge middleware, the client provider, and server code alike.
 *
 * Checks only the publishable key: it's the one Clerk env var Next.js
 * inlines into every context (client, server, edge) — `CLERK_SECRET_KEY`
 * is server-only and reads as `undefined` in client bundles, so it can't be
 * part of a check this function needs to run everywhere. In practice a real
 * publishable key without a real secret key just fails at the first Clerk
 * API call instead of here, which is an acceptable gap for a repo that
 * ships with placeholder env vars by design.
 */
export function isClerkConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_"));
}
