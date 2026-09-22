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
    colorPrimary: "hsl(245 82% 65%)",
    colorBackground: "hsl(222 40% 7%)",
    colorForeground: "hsl(210 20% 94%)",
    colorMutedForeground: "hsl(217 15% 65%)",
    colorInput: "hsl(222 25% 14%)",
    colorInputForeground: "hsl(210 20% 94%)",
    colorDanger: "hsl(0 72% 58%)",
    colorSuccess: "hsl(152 60% 45%)",
    colorWarning: "hsl(38 92% 55%)",
    colorNeutral: "hsl(210 20% 94%)",
    borderRadius: "0.625rem",
    fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif",
  },
  elements: {
    card: "shadow-none border border-[hsl(222_20%_18%)]",
  },
};
