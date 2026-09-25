import { clerkMiddleware } from "@clerk/nextjs/server";
import { isClerkConfigured } from "@nexora/auth/config";
import { NextResponse } from "next/server";

/**
 * Protected-first, like account's proxy — but console has no sign-in pages
 * of its own (§6.1: one account surface for the whole platform). An
 * unauthenticated visitor is bounced to account's sign-in with a
 * `redirect_url` back here, rather than console growing a second copy of
 * the sign-in flow.
 */
export default isClerkConfigured()
  ? clerkMiddleware(async (auth, req) => {
      const accountUrl = process.env.NEXT_PUBLIC_ACCOUNT_URL ?? "https://account.onenexora.com";
      // req.url reflects the container's own bind address (e.g.
      // 0.0.0.0:3002), not the public hostname, when running as a
      // standalone Next.js server behind a reverse proxy — build the
      // return URL from the app's own public URL instead, same as
      // accountUrl above.
      const consoleUrl = process.env.NEXT_PUBLIC_CONSOLE_URL ?? "https://console.onenexora.com";
      const returnTo = `${consoleUrl}${req.nextUrl.pathname}${req.nextUrl.search}`;
      const unauthenticatedUrl = `${accountUrl}/sign-in?redirect_url=${encodeURIComponent(returnTo)}`;
      await auth.protect({ unauthenticatedUrl });
    })
  : () => NextResponse.next();

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
