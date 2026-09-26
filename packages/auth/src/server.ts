import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { isClerkConfigured } from "./config";

/**
 * The only door into Clerk from server code (C-AUTH). Apps import from
 * `@nexora/auth/server`, never `@clerk/nextjs/server` directly — that keeps
 * the identity provider swappable (§9.2, R-4) instead of leaking Clerk
 * types across every product.
 */
export { auth, clerkClient, currentUser };

export interface RequiredAuth {
  userId: string;
  orgId: string | null | undefined;
  orgSlug: string | null | undefined;
  orgRole: string | null | undefined;
  has: Awaited<ReturnType<typeof auth>>["has"];
}

/**
 * Redirects to sign-in when there is no session. Use at the top of a
 * protected server component.
 *
 * Calling Clerk's `auth()` requires `clerkMiddleware()` to have run for the
 * request — proxy.ts skips it entirely when Clerk isn't configured (see
 * that file's comment), so `auth()` itself would throw here rather than
 * return a clean "signed out" result. Route to `/setup-required` first in
 * that case instead of letting the page crash.
 */
export async function requireAuth(signInUrl = "/sign-in"): Promise<RequiredAuth> {
  if (!isClerkConfigured()) {
    redirect("/setup-required");
  }
  const session = await auth();
  if (!session.isAuthenticated || !session.userId) {
    redirect(signInUrl);
  }
  return {
    userId: session.userId,
    orgId: session.orgId,
    orgSlug: session.orgSlug,
    orgRole: session.orgRole,
    has: session.has,
  };
}

export interface RequiredAdmin {
  userId: string;
  email: string | null;
}

function adminAllowlist(): string[] {
  return (process.env.NEXORA_ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * NEXORA staff, not a Clerk org role — the orgs Clerk models are
 * customers' organisations (§13.1), so "is this person allowed to see
 * every customer" can't be a role inside one of those. The allowlist is a
 * plain env var of emails rather than a Clerk feature because the admin
 * surface has exactly one tenant (NEXORA itself) and doesn't need Clerk's
 * per-org RBAC to answer a single yes/no question.
 *
 * A signed-in-but-not-staff visitor gets a plain 404, not a "you don't
 * have permission" page — the admin surface's existence isn't something
 * to confirm to someone who isn't on the allowlist.
 */
export async function requireAdmin(signInUrl = "/sign-in"): Promise<RequiredAdmin> {
  const session = await requireAuth(signInUrl);
  const allowlist = adminAllowlist();
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? null;
  if (allowlist.length === 0 || !email || !allowlist.includes(email.toLowerCase())) {
    notFound();
  }
  return { userId: session.userId, email };
}

/** Non-throwing check for conditional UI (e.g. whether to show the Admin nav link) — `requireAdmin` is for the page itself. */
export async function isAdmin(): Promise<boolean> {
  if (!isClerkConfigured()) return false;
  const session = await auth();
  if (!session.isAuthenticated) return false;

  const allowlist = adminAllowlist();
  if (allowlist.length === 0) return false;

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? null;
  return !!email && allowlist.includes(email.toLowerCase());
}

/** Like `requireAuth`, but also requires an active organisation (redirects to org selection otherwise). */
export async function requireOrg(
  options: { signInUrl?: string; chooseOrgUrl?: string } = {},
): Promise<RequiredAuth & { orgId: string }> {
  const session = await requireAuth(options.signInUrl);
  if (!session.orgId) {
    redirect(options.chooseOrgUrl ?? "/select-organization");
  }
  return { ...session, orgId: session.orgId };
}
