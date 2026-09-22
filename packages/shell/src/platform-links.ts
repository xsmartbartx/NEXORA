/**
 * Cross-app URLs, resolved per-deploy via env vars (each app sets its own —
 * see that app's `.env.example`) and falling back to the intended
 * production subdomains from §7.1. Consumed by the shell (product switcher)
 * and by each app's own proxy for the central sign-in redirect.
 */
export function platformLinks() {
  return {
    website: process.env.NEXT_PUBLIC_WEBSITE_URL ?? "https://onenexora.com",
    account: process.env.NEXT_PUBLIC_ACCOUNT_URL ?? "https://account.onenexora.com",
    console: process.env.NEXT_PUBLIC_CONSOLE_URL ?? "https://console.onenexora.com",
    status: process.env.NEXT_PUBLIC_STATUS_URL ?? "https://status.onenexora.com",
  };
}
