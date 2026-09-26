import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppClerkProvider } from "@nexora/auth/client";
import { isAdmin } from "@nexora/auth/server";
import { AppShell } from "@nexora/shell";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Console — NEXORA",
    template: "%s — NEXORA Console",
  },
  description: "The authenticated control plane for your NEXORA organisation.",
};

const navItems = [
  { label: "Overview", href: "/" },
  { label: "Products", href: "/products" },
  { label: "Organisation", href: "/organisation" },
  { label: "API Keys", href: "/api-keys" },
  { label: "Usage", href: "/usage" },
  { label: "Analytics", href: "/analytics" },
  { label: "Billing", href: "/billing" },
];

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Staff-only, so it's appended rather than listed statically — a
  // customer never sees a link to a surface they'd get a 404 from anyway
  // (see `requireAdmin`'s comment), and the check here is the cheap,
  // non-throwing one built for exactly this.
  const admin = await isAdmin();
  const items = admin ? [...navItems, { label: "Admin", href: "/admin" }] : navItems;

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <AppClerkProvider>
          <AppShell appName="Console" navItems={items}>
            {children}
          </AppShell>
        </AppClerkProvider>
      </body>
    </html>
  );
}
