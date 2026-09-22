import { NextResponse } from "next/server";

/**
 * The one error shape every endpoint returns (§9.4: "Public API ... a
 * published error contract"). A client that has seen one NEXORA API error
 * has seen the shape of all of them.
 */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    request_id: string;
  };
}

export function apiError(
  status: number,
  code: string,
  message: string,
): NextResponse<ApiErrorBody> {
  return NextResponse.json(
    { error: { code, message, request_id: crypto.randomUUID() } },
    { status },
  );
}
