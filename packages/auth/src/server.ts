import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

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

/** Redirects to sign-in when there is no session. Use at the top of a protected server component. */
export async function requireAuth(signInUrl = "/sign-in"): Promise<RequiredAuth> {
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
