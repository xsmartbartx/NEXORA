import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
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
