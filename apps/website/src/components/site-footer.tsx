import Link from "next/link";
import { LogoMark } from "@nexora/ui";

const developersUrl = process.env.NEXT_PUBLIC_DEVELOPERS_URL ?? "https://developers.onenexora.com";
const docsUrl = process.env.NEXT_PUBLIC_DOCS_URL ?? "https://docs.onenexora.com";
const consoleUrl = process.env.NEXT_PUBLIC_CONSOLE_URL ?? "https://console.onenexora.com";
const statusUrl = process.env.NEXT_PUBLIC_STATUS_URL ?? "https://status.onenexora.com";

const columns: { title: string; links: { label: string; href: string; external?: boolean }[] }[] = [
  {
    title: "Platform",
    links: [
      { label: "Overview", href: "/platform" },
      { label: "AI", href: "/platform/ai" },
      { label: "Security", href: "/platform/security" },
      { label: "Cloud", href: "/platform/cloud" },
    ],
  },
  {
    title: "Ecosystem",
    links: [
      { label: "Products", href: "/products" },
      { label: "Marketplace", href: "/marketplace" },
      { label: "Solutions", href: "/solutions" },
      { label: "Labs", href: "/labs" },
    ],
  },
  {
    title: "Developers",
    links: [
      { label: "Overview", href: developersUrl, external: true },
      { label: "Docs", href: docsUrl, external: true },
      { label: "Console", href: consoleUrl, external: true },
      { label: "Status", href: statusUrl, external: true },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/company" },
      { label: "Contact", href: "/company#contact" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-5">
          <div className="col-span-2 sm:col-span-1">
            <Link href="/" className="flex items-center gap-2">
              <LogoMark className="h-6 w-6" />
              <span className="font-mono text-sm font-semibold tracking-widest uppercase">
                NEXORA
              </span>
            </Link>
            <p className="mt-3 max-w-[22ch] text-sm text-muted-foreground">
              Build What&rsquo;s Next.
            </p>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                {col.title}
              </h3>
              <ul className="mt-3 flex flex-col gap-2">
                {col.links.map((link) =>
                  link.external ? (
                    <li key={link.href}>
                      <a
                        href={link.href}
                        className="text-sm text-foreground/80 transition-colors hover:text-foreground"
                      >
                        {link.label}
                      </a>
                    </li>
                  ) : (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-sm text-foreground/80 transition-colors hover:text-foreground"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ),
                )}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} NEXORA. All rights reserved.</p>
          <p>Legal pages are on the Phase 4+ build plan.</p>
        </div>
      </div>
    </footer>
  );
}
