import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { isClerkConfigured } from "@nexora/auth/config";
import { NextResponse } from "next/server";

/**
 * Protected-first (§6.1: account.onenexora.com is entirely a self-service
 * surface behind auth) — everything requires a session except sign-in/up.
 *
 * `clerkMiddleware()` throws at request time if the Clerk keys aren't real,
 * which would break every request while this repo still ships with
 * placeholder env vars. Skip Clerk entirely rather than let that surface as
 * a crash — this passthrough goes away automatically once real keys land.
 */
const isPublicRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"]);

export default isClerkConfigured()
  ? clerkMiddleware(async (auth, req) => {
      if (!isPublicRoute(req)) await auth.protect();
    })
  : () => NextResponse.next();

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
