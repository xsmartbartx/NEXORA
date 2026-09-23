import crypto from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { apiKeys } from "./schema";
import { db } from "./client";

export interface AuthenticatedKey {
  keyId: string;
  orgId: string;
}

export type ApiKeyAuthResult =
  | { ok: true; key: AuthenticatedKey }
  | { ok: false; status: 401; code: "missing_api_key" | "invalid_api_key"; message: string };

function hashKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

/**
 * Machine identity (§6.4), shared by every product that authenticates
 * machine requests via a NEXORA API key — currently `apps/api` and
 * `apps/gateway` — rather than each maintaining its own copy. Validates the
 * `Authorization: Bearer nx_live_...` header against the hash Console's API
 * Keys page wrote (apps/console/src/app/api-keys/actions.ts). Never
 * compares against or logs the raw key.
 */
export async function authenticateApiKey(request: Request): Promise<ApiKeyAuthResult> {
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
