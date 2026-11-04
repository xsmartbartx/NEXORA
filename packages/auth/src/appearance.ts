import type { ClerkAppearanceTheme } from "@clerk/shared/types";

/**
 * Makes `<SignIn />`, `<UserProfile />`, `<OrganizationProfile />` etc. read
 * as NEXORA rather than default Clerk.
 *
 * The colours are not set here: packages/ui/src/tokens.css sets Clerk's
 * native `--clerk-color-*` CSS variables from the design tokens, so the
 * components follow the same light and dark palettes as the rest of the
 * page (https://clerk.com/docs/guides/customizing-clerk/appearance-prop/variables).
 * Setting colours in `variables` as well would override those, and literal
 * colours cannot change with `prefers-color-scheme`.
 *
 * `Appearance` was renamed `ClerkAppearanceTheme` in Core 3, moving from
 * the now-deprecated `@clerk/types` to `@clerk/shared/types`.
 */
export const clerkAppearance: ClerkAppearanceTheme = {
  variables: {
    borderRadius: "0.5rem",
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  },
  elements: {
    card: "shadow-none border border-border",
  },
};
