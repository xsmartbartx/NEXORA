import crypto from "node:crypto";
import { eq, isNull, and } from "drizzle-orm";
import { apiKeys, db } from "@nexora/database";

export interface AuthenticatedKey {
  keyId: string;
  orgId: string;
}

export type AuthResult =
  | { ok: true; key: AuthenticatedKey }
  | { ok: false; status: 401; code: "missing_api_key" | "invalid_api_key"; message: string };

function hashKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

/**
 * Machine identity (§6.4): validates the `Authorization: Bearer nx_live_...`
 * header against the hash stored by Console's API Keys page (same
 * `packages/database` table, same hash algorithm — see
 * apps/console/src/app/api-keys/actions.ts). Never compares against or logs
 * the raw key.
 */
export async function authenticateRequest(request: Request): Promise<AuthResult> {
  const header = request.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return {
      ok: false,
      status: 401,
      code: "missing_api_key",
      message:
        "Missing or malformed Authorization header. Expected: Authorization: Bearer nx_live_...",
    };
  }

  const keyHash = hashKey(token);
  const [row] = await db
    .select({ id: apiKeys.id, orgId: apiKeys.orgId })
    .from(apiKeys)
    .where(and(eq(apiKeys.keyHash, keyHash), isNull(apiKeys.revokedAt)))
    .limit(1);

  if (!row) {
    return {
      ok: false,
      status: 401,
      code: "invalid_api_key",
      message: "This API key is invalid or has been revoked.",
    };
  }

  // Fire-and-forget: never let a usage-tracking write fail the request.
  db.update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, row.id))
    .catch(() => undefined);

  return { ok: true, key: { keyId: row.id, orgId: row.orgId } };
}
