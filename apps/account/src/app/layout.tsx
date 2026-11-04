import type { Metadata } from "next";
import "./globals.css";
import { AppClerkProvider } from "@nexora/auth/client";

export const metadata: Metadata = {
  title: {
    default: "Account — NEXORA",
    template: "%s — NEXORA Account",
  },
  description: "Profile, security and organisations for your NEXORA account.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-background text-foreground">
        <AppClerkProvider>{children}</AppClerkProvider>
      </body>
    </html>
  );
}
