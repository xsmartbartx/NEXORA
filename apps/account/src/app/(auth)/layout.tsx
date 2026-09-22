import { LogoMark } from "@nexora/ui";
import { isClerkConfigured } from "@nexora/auth/config";
import { SetupRequiredNotice } from "@nexora/shell";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-16 items-center px-6">
        <a href="https://onenexora.com" className="flex items-center gap-2">
          <LogoMark className="h-6 w-6" />
          <span className="font-mono text-sm font-semibold tracking-widest uppercase">NEXORA</span>
        </a>
      </header>
      <main className="flex flex-1 flex-col">
        {/*
         * sign-in/sign-up render Clerk's <SignIn />/<SignUp /> directly and
         * have no `requireAuth()` guard of their own (they're the pre-auth
         * entry point) — so unlike every other protected route, nothing
         * else stops them from rendering a Clerk component with no
         * ClerkProvider ancestor when Clerk isn't configured. Gate here
         * instead, once, for the whole route group.
         */}
        {isClerkConfigured() ? children : <SetupRequiredNotice appName="Account" />}
      </main>
    </div>
  );
}
