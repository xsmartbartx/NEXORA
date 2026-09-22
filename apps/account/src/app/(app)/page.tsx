import Link from "next/link";
import { requireAuth } from "@nexora/auth/server";

export default async function AccountHome() {
  const { userId } = await requireAuth();

  return (
    <div className="mx-auto max-w-2xl px-6 py-20">
      <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        Account
      </span>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Welcome back.</h1>
      <p className="mt-2 text-sm text-muted-foreground">Signed in as {userId}</p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <Link
          href="/user-profile"
          className="rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/50"
        >
          <h2 className="font-medium">Profile &amp; security</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Update your profile, password, MFA and active sessions.
          </p>
        </Link>
        <Link
          href="/organizations"
          className="rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/50"
        >
          <h2 className="font-medium">Organisations</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            See every organisation you belong to, or create a new one.
          </p>
        </Link>
      </div>
    </div>
  );
}
