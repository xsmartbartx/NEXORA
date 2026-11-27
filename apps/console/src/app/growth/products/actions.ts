"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireOrg } from "@nexora/auth/server";
import { db, growthProductProfiles } from "@nexora/database";
import { getProductBySlug } from "@nexora/registry";
import { logEvent } from "@nexora/telemetry";

const PROFILE_FIELDS = [
  ["idealCustomerProfile", "Ideal customer profile", 4_000],
  ["positioning", "Positioning", 2_000],
  ["valueProposition", "Value proposition", 2_000],
  ["differentiators", "Differentiators", 2_000],
] as const;

function readText(
  formData: FormData,
  key: string,
  label: string,
  max: number,
): string {
  const value = String(formData.get(key) ?? "").trim();
  if (value.length > max) throw new Error(`${label} exceeds ${max} characters`);
  return value;
}

function readLines(
  formData: FormData,
  key: string,
  label: string,
  maxItems: number,
): string[] {
  const raw = String(formData.get(key) ?? "");
  const values = [
    ...new Set(
      raw.split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
    ),
  ];
  if (values.length > maxItems) {
    throw new Error(`${label} supports at most ${maxItems} entries`);
  }
  if (values.some((item) => item.length > 240)) {
    throw new Error(`${label} entries must be 240 characters or fewer`);
  }
  return values;
}

export async function listGrowthProductProfiles() {
  const { orgId } = await requireOrg();
  return db
    .select()
    .from(growthProductProfiles)
    .where(eq(growthProductProfiles.orgId, orgId))
    .orderBy(desc(growthProductProfiles.updatedAt));
}

export async function saveGrowthProductProfile(formData: FormData): Promise<void> {
  const { orgId, userId } = await requireOrg();
  const productSlug = String(formData.get("productSlug") ?? "").trim();
  if (
    !productSlug ||
    productSlug.length > 120 ||
    !getProductBySlug(productSlug)
  ) {
    throw new Error("Select a product that exists in the Product Registry");
  }

  const profile = Object.fromEntries(
    PROFILE_FIELDS.map(([key, label, max]) => [
      key,
      readText(formData, key, label, max),
    ]),
  ) as Record<(typeof PROFILE_FIELDS)[number][0], string>;

  const targetRoles = readLines(formData, "targetRoles", "Target roles", 30);
  const useCases = readLines(formData, "useCases", "Use cases", 30);
  const approvedClaims = readLines(
    formData,
    "approvedClaims",
    "Approved claims",
    50,
  );

  const [saved] = await db
    .insert(growthProductProfiles)
    .values({
      orgId,
      productSlug,
      ...profile,
      targetRoles,
      useCases,
      approvedClaims,
      createdBy: userId,
      updatedBy: userId,
    })
    .onConflictDoUpdate({
      target: [growthProductProfiles.orgId, growthProductProfiles.productSlug],
      set: {
        ...profile,
        targetRoles,
        useCases,
        approvedClaims,
        updatedBy: userId,
        updatedAt: new Date(),
      },
    })
    .returning({ id: growthProductProfiles.id });

  if (!saved) throw new Error("Product profile could not be saved");

  await logEvent({
    orgId,
    actorId: userId,
    action: "console.growth.product_profile.saved",
    resourceType: "growth_product_profile",
    resourceId: saved.id,
    metadata: {
      productSlug,
      targetRoleCount: targetRoles.length,
      useCaseCount: useCases.length,
      approvedClaimCount: approvedClaims.length,
    },
  });

  revalidatePath("/growth");
  revalidatePath("/growth/products");
}
