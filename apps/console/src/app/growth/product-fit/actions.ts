"use server";

import { and, asc, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireOrg } from "@nexora/auth/server";
import { db, growthCustomerSegments, growthSegmentProductFits } from "@nexora/database";
import { getProductBySlug } from "@nexora/registry";
import { logEvent } from "@nexora/telemetry";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function textField(
  formData: FormData,
  key: string,
  label: string,
  max: number,
  required = false,
): string {
  const value = String(formData.get(key) ?? "").trim();
  if (required && !value) throw new Error(`${label} is required`);
  if (value.length > max) throw new Error(`${label} exceeds ${max} characters`);
  return value;
}

function scoreField(formData: FormData, key: string, label: string): number | null {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return null;
  if (!/^[0-5]$/.test(raw)) throw new Error(`${label} must be an integer from 0 to 5`);
  return Number(raw);
}

export async function listGrowthProductSegmentFits() {
  const { orgId } = await requireOrg();
  const rows = await db
    .select({
      id: growthSegmentProductFits.id,
      segmentId: growthSegmentProductFits.segmentId,
      segmentName: growthCustomerSegments.name,
      productSlug: growthSegmentProductFits.productSlug,
      needAlignmentScore: growthSegmentProductFits.needAlignmentScore,
      capabilityCoverageScore: growthSegmentProductFits.capabilityCoverageScore,
      urgencyScore: growthSegmentProductFits.urgencyScore,
      budgetReadinessScore: growthSegmentProductFits.budgetReadinessScore,
      buyingCommitteeFitScore: growthSegmentProductFits.buyingCommitteeFitScore,
      status: growthSegmentProductFits.status,
      rationale: growthSegmentProductFits.rationale,
      evidenceNotes: growthSegmentProductFits.evidenceNotes,
      updatedAt: growthSegmentProductFits.updatedAt,
    })
    .from(growthSegmentProductFits)
    .innerJoin(
      growthCustomerSegments,
      and(
        eq(growthCustomerSegments.id, growthSegmentProductFits.segmentId),
        eq(growthCustomerSegments.orgId, orgId),
      ),
    )
    .where(eq(growthSegmentProductFits.orgId, orgId))
    .orderBy(asc(growthCustomerSegments.name), desc(growthSegmentProductFits.updatedAt));

  return rows.map((row) => ({
    ...row,
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function saveGrowthProductSegmentFit(formData: FormData): Promise<void> {
  const { orgId, userId } = await requireOrg();
  const segmentId = textField(formData, "segmentId", "Customer segment", 36, true);
  if (!UUID_PATTERN.test(segmentId)) throw new Error("Customer segment id is invalid");

  const [segment] = await db
    .select({ id: growthCustomerSegments.id })
    .from(growthCustomerSegments)
    .where(and(eq(growthCustomerSegments.id, segmentId), eq(growthCustomerSegments.orgId, orgId)))
    .limit(1);
  if (!segment) throw new Error("Customer segment not found in this organisation");

  const productSlug = textField(formData, "productSlug", "Product", 120, true);
  if (!getProductBySlug(productSlug))
    throw new Error("Product does not exist in the Product Registry");

  const status = textField(formData, "status", "Assessment status", 20, true);
  if (!["hypothesis", "validated", "not_fit"].includes(status)) {
    throw new Error("Invalid assessment status");
  }

  const scores = {
    needAlignmentScore: scoreField(formData, "needAlignmentScore", "Need alignment"),
    capabilityCoverageScore: scoreField(formData, "capabilityCoverageScore", "Capability coverage"),
    urgencyScore: scoreField(formData, "urgencyScore", "Urgency"),
    budgetReadinessScore: scoreField(formData, "budgetReadinessScore", "Budget readiness"),
    buyingCommitteeFitScore: scoreField(
      formData,
      "buyingCommitteeFitScore",
      "Buying committee fit",
    ),
  };
  if (Object.values(scores).every((score) => score === null)) {
    throw new Error("Enter at least one criterion score; leave unknown criteria empty");
  }

  const rationale = textField(formData, "rationale", "Assessment rationale", 2_000, true);
  const evidenceNotes = textField(formData, "evidenceNotes", "Evidence notes", 4_000);
  if (status === "validated" && !evidenceNotes) {
    throw new Error("Validated assessments require evidence notes");
  }

  const [saved] = await db
    .insert(growthSegmentProductFits)
    .values({
      orgId,
      segmentId,
      productSlug,
      ...scores,
      status,
      rationale,
      evidenceNotes,
      createdBy: userId,
      updatedBy: userId,
    })
    .onConflictDoUpdate({
      target: [
        growthSegmentProductFits.orgId,
        growthSegmentProductFits.segmentId,
        growthSegmentProductFits.productSlug,
      ],
      set: {
        ...scores,
        status,
        rationale,
        evidenceNotes,
        updatedBy: userId,
        updatedAt: new Date(),
      },
    })
    .returning({ id: growthSegmentProductFits.id });

  if (!saved) throw new Error("Product-segment fit assessment could not be saved");

  await logEvent({
    orgId,
    actorId: userId,
    action: "console.growth.product_segment_fit.saved",
    resourceType: "growth_segment_product_fit",
    resourceId: saved.id,
    metadata: {
      segmentId,
      productSlug,
      status,
      populatedCriteria: Object.values(scores).filter((score) => score !== null).length,
    },
  });
  revalidatePath("/growth");
  revalidatePath("/growth/product-fit");
}
