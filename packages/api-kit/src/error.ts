import { NextResponse } from "next/server";

/**
 * The one error shape every machine-facing endpoint returns (§9.4: "a
 * published error contract"). A client that has seen one NEXORA error has
 * seen the shape of all of them, across every product.
 */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    request_id: string;
  };
}

export function apiError(status: number, code: string, message: string): NextResponse<ApiErrorBody> {
  return NextResponse.json(
    { error: { code, message, request_id: crypto.randomUUID() } },
    { status },
  );
}
