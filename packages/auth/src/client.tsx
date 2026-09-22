"use client";

import {
  ClerkProvider,
  CreateOrganization,
  OrganizationList,
  OrganizationProfile,
  OrganizationSwitcher,
  Show,
  SignIn,
  SignInButton,
  SignUp,
  SignUpButton,
  UserButton,
  UserProfile,
  useAuth,
  useOrganization,
  useUser,
} from "@clerk/nextjs";
import { clerkAppearance } from "./appearance";
import { isClerkConfigured } from "./config";

/**
 * Re-exported through here rather than imported from `@clerk/nextjs`
 * directly, for the same reason as `server.ts` — one place products depend
 * on, not the provider itself.
 */
export {
  CreateOrganization,
  OrganizationList,
  OrganizationProfile,
  OrganizationSwitcher,
  Show,
  SignIn,
  SignInButton,
  SignUp,
  SignUpButton,
  UserButton,
  UserProfile,
  useAuth,
  useOrganization,
  useUser,
};

const isConfigured = isClerkConfigured();

/**
 * Wraps Clerk's `ClerkProvider` with NEXORA's appearance, and — since this
 * repo is scaffolded with placeholder env vars — degrades to a plain
 * passthrough instead of Clerk's hard throw when no real key is present.
 * `next build`/`next dev` stay usable before Clerk is actually configured;
 * swap in real keys and this activates with no code change.
 */
export function AppClerkProvider({ children }: { children: React.ReactNode }) {
  if (!isConfigured) {
    return <>{children}</>;
  }
  return <ClerkProvider appearance={clerkAppearance}>{children}</ClerkProvider>;
}

export function ClerkNotConfiguredNotice() {
  if (isConfigured) return null;
  return (
    <div className="border-b border-warning/30 bg-warning/10 px-6 py-2 text-center text-xs text-warning">
      Identity provider not configured — set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY.
      Sign-in is disabled until then.
    </div>
  );
}
