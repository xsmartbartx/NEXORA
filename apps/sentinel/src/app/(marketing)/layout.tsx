import { LogoMark } from "@nexora/ui";

const websiteUrl = process.env.NEXT_PUBLIC_WEBSITE_URL ?? "https://onenexora.com";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-5xl items-center px-6">
          <a href={websiteUrl} className="flex items-center gap-2">
            <LogoMark className="h-6 w-6" />
            <span className="font-mono text-sm font-semibold tracking-widest uppercase">
              NEXORA
            </span>
          </a>
          <span className="ml-3 text-sm text-muted-foreground">Sentinel</span>
        </div>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
