import type { Metadata } from "next";
import "./globals.css";
import { AppClerkProvider } from "@nexora/auth/client";

export const metadata: Metadata = {
  title: {
    default: "CSPM — NEXORA",
    template: "%s — CSPM",
  },
  description: "Paste your cloud config, get real findings back.",
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
