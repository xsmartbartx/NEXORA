import type { NextResponse } from "next/server";
import { NEURAWALL_LINK_SCOPE, type AuthenticatedKey } from "@nexora/database";
import { apiError } from "./error";

/**
 * Returns the 403 to send when `key` lacks `scope`, or `null` when it has it.
 * Least privilege for machine identity (§6.4): a key made for one integration
 * cannot be used for another.
 */
export function requireScope(key: AuthenticatedKey, scope: string): NextResponse | null {
  if (key.scopes.includes(scope)) return null;
  return apiError(
    403,
    "insufficient_scope",
    `This API key needs the "${scope}" scope. Create a key with it in Console.`,
  );
}

export { NEURAWALL_LINK_SCOPE };
