import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { isClerkConfigured } from "@nexora/auth/config";
import { NextResponse } from "next/server";

/**
 * Public-first (R-2: the subdomain root is a public overview, never a
 * login screen) — only /app requires a session. /api/health stays public
 * on purpose, for the future Health service (T-6).
 */
const isProtectedRoute = createRouteMatcher(["/app(.*)"]);

export default isClerkConfigured()
  ? clerkMiddleware(async (auth, req) => {
      if (isProtectedRoute(req)) await auth.protect();
    })
  : () => NextResponse.next();

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
