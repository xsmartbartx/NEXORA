import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { LogoMark } from "@nexora/ui";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NEXORA for Developers",
  description: "What you can build on NEXORA, and where to start.",
};

const websiteUrl = process.env.NEXT_PUBLIC_WEBSITE_URL ?? "https://onenexora.com";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <header className="border-b border-border">
          <div className="mx-auto flex h-16 max-w-5xl items-center px-6">
            <a href={websiteUrl} className="flex items-center gap-2">
              <LogoMark className="h-6 w-6" />
              <span className="font-mono text-sm font-semibold tracking-widest uppercase">
                NEXORA
              </span>
            </a>
            <span className="ml-3 text-sm text-muted-foreground">Developers</span>
          </div>
        </header>
        <main className="flex flex-1 flex-col">{children}</main>
      </body>
    </html>
  );
}
