import type { Appearance } from "@clerk/types";

/**
 * Maps Clerk's appearance variables onto the same values as
 * packages/ui/src/tokens.css, so `<SignIn />`, `<UserProfile />`,
 * `<OrganizationProfile />` etc. read as NEXORA rather than default Clerk.
 * Kept in sync by hand — Clerk's `variables` need literal color strings,
 * not CSS custom properties, so these can't just reference tokens.css.
 */
export const clerkAppearance: Appearance = {
  variables: {
    colorPrimary: "hsl(245 82% 65%)",
    colorBackground: "hsl(222 40% 7%)",
    colorText: "hsl(210 20% 94%)",
    colorTextSecondary: "hsl(217 15% 65%)",
    colorInputBackground: "hsl(222 25% 14%)",
    colorInputText: "hsl(210 20% 94%)",
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
