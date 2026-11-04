import type { ClerkAppearanceTheme } from "@clerk/shared/types";

/**
 * Maps Clerk's appearance variables onto the same values as
 * packages/ui/src/tokens.css, so `<SignIn />`, `<UserProfile />`,
 * `<OrganizationProfile />` etc. read as NEXORA rather than default Clerk.
 * Kept in sync by hand — Clerk's `variables` need literal color strings,
 * not CSS custom properties, so these can't just reference tokens.css.
 *
 * `Appearance` was renamed `ClerkAppearanceTheme` in Core 3, moving from
 * the now-deprecated `@clerk/types` to `@clerk/shared/types` — and several
 * `variables` keys were renamed at the same time (colorText →
 * colorForeground, colorTextSecondary → colorMutedForeground, etc.).
 */
export const clerkAppearance: ClerkAppearanceTheme = {
  variables: {
    colorPrimary: "hsl(243 75.4% 58.6%)",
    colorBackground: "hsl(240 5.9% 10%)",
    colorForeground: "hsl(240 4.8% 95.9%)",
    colorMutedForeground: "hsl(240 5% 64.9%)",
    colorInput: "hsl(240 3.7% 15.9%)",
    colorInputForeground: "hsl(240 4.8% 95.9%)",
    colorDanger: "hsl(0 84.2% 60.2%)",
    colorSuccess: "hsl(158 64.4% 51.6%)",
    colorWarning: "hsl(43 96.4% 56.3%)",
    colorNeutral: "hsl(240 4.8% 95.9%)",
    borderRadius: "0.5rem",
    fontFamily: "ui-sans-serif, system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif",
  },
  elements: {
    card: "shadow-none border border-[hsl(240_3.7%_15.9%)]",
  },
};
