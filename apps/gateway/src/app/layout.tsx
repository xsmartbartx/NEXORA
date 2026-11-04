import type { Metadata } from "next";
import "./globals.css";
import { AppClerkProvider } from "@nexora/auth/client";

export const metadata: Metadata = {
  title: {
    default: "Gateway — NEXORA",
    template: "%s — Gateway",
  },
  description: "A governed front door for every model call your org makes.",
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
