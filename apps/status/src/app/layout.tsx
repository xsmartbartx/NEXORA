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
  title: {
    default: "Status — NEXORA",
    template: "%s — NEXORA Status",
  },
  description: "Live status of every NEXORA platform surface.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <header className="border-b border-border">
          <div className="mx-auto flex h-16 max-w-3xl items-center px-6">
            <a href="https://onenexora.com" className="flex items-center gap-2">
              <LogoMark className="h-6 w-6" />
              <span className="font-mono text-sm font-semibold tracking-widest uppercase">
                NEXORA
              </span>
            </a>
            <span className="ml-3 text-sm text-muted-foreground">Status</span>
          </div>
        </header>
        <main className="flex flex-1 flex-col">{children}</main>
      </body>
    </html>
  );
}
