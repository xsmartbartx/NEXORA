import type { Metadata } from "next";
import "./globals.css";
import { AppClerkProvider } from "@nexora/auth/client";

export const metadata: Metadata = {
  title: {
    default: "Sentinel — NEXORA",
    template: "%s — Sentinel",
  },
  description: "Paste a log sample, find the ten lines worth reading.",
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
