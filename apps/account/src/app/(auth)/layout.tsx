import { LogoMark } from "@nexora/ui";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-16 items-center px-6">
        <a href="https://onenexora.com" className="flex items-center gap-2">
          <LogoMark className="h-6 w-6" />
          <span className="font-mono text-sm font-semibold tracking-widest uppercase">
            NEXORA
          </span>
        </a>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
