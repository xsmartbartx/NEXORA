import type { Metadata } from "next";
import "./globals.css";
import { DocsShell } from "@/components/docs-shell";

export const metadata: Metadata = {
  title: {
    default: "NEXORA Docs",
    template: "%s — NEXORA Docs",
  },
  description: "Documentation for building on the NEXORA platform.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-background text-foreground">
        <DocsShell>{children}</DocsShell>
      </body>
    </html>
  );
}
