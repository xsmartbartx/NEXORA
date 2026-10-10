"use server";

import crypto from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireOrg } from "@nexora/auth/server";
import { apiKeys, db, NEURAWALL_LINK_SCOPE } from "@nexora/database";
import { logEvent } from "@nexora/telemetry";

/**
 * §6.4: hashed at rest, plaintext shown exactly once. SHA-256 (unsalted) is
 * appropriate here — unlike a password, this secret is 24 random bytes of
 * entropy generated server-side, so there is nothing a rainbow table or
 * per-user salt would protect against that the entropy itself doesn't
 * already cover.
 */
function generateApiKey() {
  const secret = crypto.randomBytes(24).toString("base64url");
  const key = `nx_live_${secret}`;
  const keyPrefix = `${key.slice(0, 12)}…`;
  const keyHash = crypto.createHash("sha256").update(key).digest("hex");
  return { key, keyPrefix, keyHash };
}

export interface ApiKeySummary {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  scopes: string[];
}

export async function listApiKeys(): Promise<ApiKeySummary[]> {
  const { orgId } = await requireOrg();
  const rows = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.orgId, orgId))
    .orderBy(desc(apiKeys.createdAt));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    keyPrefix: row.keyPrefix,
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
    scopes: row.scopes,
  }));
}

export async function createApiKey(
  formData: FormData,
): Promise<{ id: string; key: string; keyPrefix: string; name: string; scopes: string[] }> {
  const { userId, orgId } = await requireOrg();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Name is required");

  // The only scope today is for linking a NeuraWall installation; a key made without it
  // cannot read the plan or write events for one (least privilege, §6.4).
  const scopes = formData.get("neurawall_link") === "on" ? [NEURAWALL_LINK_SCOPE] : [];
  const { key, keyPrefix, keyHash } = generateApiKey();

  const [inserted] = await db
    .insert(apiKeys)
    .values({ orgId, name, keyPrefix, keyHash, scopes, createdBy: userId })
    .returning({ id: apiKeys.id });
  if (!inserted) throw new Error("Failed to create key");

  await logEvent({
    orgId,
    actorId: userId,
    action: "console.api_key.created",
    resourceType: "api_key",
    resourceId: inserted.id,
    metadata: { scopes },
  });

  revalidatePath("/api-keys");
  return { id: inserted.id, key, keyPrefix, name, scopes };
}

export async function revokeApiKey(keyId: string): Promise<void> {
  const { userId, orgId } = await requireOrg();

  await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.orgId, orgId)));

  await logEvent({
    orgId,
    actorId: userId,
    action: "console.api_key.revoked",
    resourceType: "api_key",
    resourceId: keyId,
  });

  revalidatePath("/api-keys");
}
