"use client";

import { cn, LogoMark } from "@nexora/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { docsNav } from "@/lib/nav";

const websiteUrl = process.env.NEXT_PUBLIC_WEBSITE_URL ?? "https://onenexora.com";

export function DocsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-6">
          <a href={websiteUrl} className="flex items-center gap-2">
            <LogoMark className="h-6 w-6" />
            <span className="font-mono text-sm font-semibold tracking-widest uppercase">
              NEXORA
            </span>
          </a>
          <span className="text-sm text-muted-foreground">Docs</span>
        </div>
      </header>

      <nav className="flex gap-1 overflow-x-auto border-b border-border px-6 py-2 md:hidden">
        {docsNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="shrink-0 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-6 py-10 md:flex-row">
        <nav className="hidden w-48 shrink-0 md:block">
          <ul className="sticky top-10 flex flex-col gap-1">
            {docsNav.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "block rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-accent hover:text-foreground",
                      active ? "bg-accent text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
