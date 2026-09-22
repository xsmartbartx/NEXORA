/**
 * What `requireAuth`/`requireOrg` redirect to when Clerk isn't configured.
 * Each app mounts this at `/setup-required` — see that route's own
 * `page.tsx` for why it has to be a real route rather than a shared
 * component alone (`redirect()` needs an actual URL to send the browser to).
 */
export function SetupRequiredNotice({ appName }: { appName: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-28 text-center">
      <span className="font-mono text-xs uppercase tracking-widest text-warning">
        Setup required
      </span>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
        {appName} needs an identity provider.
      </h1>
      <p className="mt-4 max-w-md text-muted-foreground">
        This page requires a signed-in session, but{" "}
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">
          NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
        </code>{" "}
        and{" "}
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">CLERK_SECRET_KEY</code>{" "}
        aren&rsquo;t set yet. Add real Clerk keys to this app&rsquo;s environment
        and reload.
      </p>
    </div>
  );
}
