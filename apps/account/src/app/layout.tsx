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
    default: "Account — NEXORA",
    template: "%s — NEXORA Account",
  },
  description: "Profile, security and organisations for your NEXORA account.",
};

const navItems = [
  { label: "Profile", href: "/user-profile" },
  { label: "Organisations", href: "/organizations" },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <AppClerkProvider>
          <AppShell appName="Account" navItems={navItems}>
            {children}
          </AppShell>
        </AppClerkProvider>
      </body>
    </html>
  );
}
