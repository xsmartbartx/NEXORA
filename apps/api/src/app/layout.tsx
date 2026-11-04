import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NEXORA API",
  description: "The NEXORA public API.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-background text-foreground">{children}</body>
    </html>
  );
}
