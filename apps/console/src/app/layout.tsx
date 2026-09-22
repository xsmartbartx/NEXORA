import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppClerkProvider } from "@nexora/auth/client";
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
  { label: "Billing", href: "/billing" },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <AppClerkProvider>
          <AppShell appName="Console" navItems={navItems}>
            {children}
          </AppShell>
        </AppClerkProvider>
      </body>
    </html>
  );
}
