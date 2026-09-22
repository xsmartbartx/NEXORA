import { NextResponse } from "next/server";

/** Tenant Contract T-6: a health endpoint the future Health service consumes. */
export async function GET() {
  return NextResponse.json({ status: "ok", time: new Date().toISOString() });
}
