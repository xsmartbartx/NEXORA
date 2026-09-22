import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppClerkProvider } from "@nexora/auth/client";

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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full bg-background text-foreground">
        <AppClerkProvider>{children}</AppClerkProvider>
      </body>
    </html>
  );
}
