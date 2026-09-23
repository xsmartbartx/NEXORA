import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { isClerkConfigured } from "@nexora/auth/config";
import { NextResponse } from "next/server";

/**
 * Public-first (R-2) — only /app requires a Clerk session. /v1/chat
 * authenticates with a NEXORA API key instead (§6.4 machine identity), not
 * a user session, so it's deliberately outside `isProtectedRoute`.
 * /api/health stays public too, for the future Health service (T-6).
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
