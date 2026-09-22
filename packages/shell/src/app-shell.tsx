"use client";

import {
  ClerkNotConfiguredNotice,
  OrganizationSwitcher,
  UserButton,
} from "@nexora/auth/client";
import { cn, LogoMark } from "@nexora/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { EnvironmentBadge } from "./environment-badge";
import { ProductSwitcher } from "./product-switcher";
import { platformLinks } from "./platform-links";

export interface ShellNavItem {
  label: string;
  href: string;
}

export interface AppShellProps {
  /** Shown next to the wordmark, e.g. "Console" or "Account". */
  appName: string;
  navItems: ShellNavItem[];
  children: React.ReactNode;
}

/**
 * The one shell every authenticated NEXORA surface renders (§8.4):
 * wordmark, product switcher, nav, environment badge, org switcher, account
 * menu. Identical component, different `appName`/`navItems` per app.
 */
export function AppShell({ appName, navItems, children }: AppShellProps) {
  const pathname = usePathname();
  const links = platformLinks();

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <ClerkNotConfiguredNotice />
      <header className="border-b border-border">
        <div className="flex h-16 items-center gap-4 px-6">
          <ProductSwitcher />

          <a href={links.website} className="flex items-center gap-2">
            <LogoMark className="h-6 w-6" />
            <span className="hidden font-mono text-sm font-semibold tracking-widest uppercase sm:inline">
              NEXORA
            </span>
          </a>
          <span className="text-sm text-muted-foreground">{appName}</span>

          <nav className="ml-4 hidden items-center gap-1 md:flex">
            {navItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                    active ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <EnvironmentBadge />
            <OrganizationSwitcher hidePersonal={false} />
            <UserButton />
          </div>
        </div>

        <nav className="flex items-center gap-1 overflow-x-auto border-t border-border px-6 py-2 md:hidden">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="shrink-0 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
