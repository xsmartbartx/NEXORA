import { NextResponse } from "next/server";
import { auth } from "@nexora/auth/server";
import { buildNeurawallHandoffUrl, isValidHandoffState } from "@/lib/neurawall-handoff";

// Signed-out visitors never reach this handler: proxy.ts sends them to
// sign-in and back here. The token comes from the `neurawall-sso` Clerk JWT
// template (short lifetime, audience "neurawall") and is only ever handed to
// the configured NeuraWall origin.
export async function GET(request: Request) {
  const state = new URL(request.url).searchParams.get("state");
  if (!isValidHandoffState(state)) {
    return new NextResponse("Invalid request.", { status: 400 });
  }

  const session = await auth();
  const token = session.isAuthenticated
    ? await session.getToken({ template: "neurawall-sso" })
    : null;
  if (!token) {
    return new NextResponse("Could not issue a sign-in token.", { status: 401 });
  }

  return NextResponse.redirect(buildNeurawallHandoffUrl(token, state, process.env.NEURAWALL_URL), {
    status: 303,
    headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}
