import { NextResponse } from "next/server";

/**
 * Unauthenticated on purpose — the first thing a developer (or the future
 * Health service, §4.1) should be able to check without a key yet.
 */
export async function GET() {
  return NextResponse.json({ status: "ok", time: new Date().toISOString() });
}
