"use server";

import { and, asc, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireOrg } from "@nexora/auth/server";
import { db, growthCustomerPersonas, growthCustomerSegments } from "@nexora/database";
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

function lineList(formData: FormData, key: string, label: string): string[] {
  const values = [
    ...new Set(
      String(formData.get(key) ?? "")
        .split(/\r?\n/)
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ];
  if (values.length > 30) throw new Error(`${label} supports at most 30 entries`);
  if (values.some((value) => value.length > 240)) {
    throw new Error(`${label} entries must be 240 characters or fewer`);
  }
  return values;
}

export async function listGrowthCustomerIntelligence() {
  const { orgId } = await requireOrg();
  const [segments, personas] = await Promise.all([
    db
      .select()
      .from(growthCustomerSegments)
      .where(eq(growthCustomerSegments.orgId, orgId))
      .orderBy(asc(growthCustomerSegments.name)),
    db
      .select({
        id: growthCustomerPersonas.id,
        segmentId: growthCustomerPersonas.segmentId,
        segmentName: growthCustomerSegments.name,
        productSlug: growthCustomerPersonas.productSlug,
        name: growthCustomerPersonas.name,
        role: growthCustomerPersonas.role,
        seniority: growthCustomerPersonas.seniority,
        goals: growthCustomerPersonas.goals,
        painPoints: growthCustomerPersonas.painPoints,
        jobsToBeDone: growthCustomerPersonas.jobsToBeDone,
        objections: growthCustomerPersonas.objections,
        successCriteria: growthCustomerPersonas.successCriteria,
        buyingSignals: growthCustomerPersonas.buyingSignals,
        evidenceNotes: growthCustomerPersonas.evidenceNotes,
        confidence: growthCustomerPersonas.confidence,
        status: growthCustomerPersonas.status,
        updatedAt: growthCustomerPersonas.updatedAt,
      })
      .from(growthCustomerPersonas)
      .innerJoin(
        growthCustomerSegments,
        and(
          eq(growthCustomerSegments.id, growthCustomerPersonas.segmentId),
          eq(growthCustomerSegments.orgId, orgId),
        ),
      )
      .where(eq(growthCustomerPersonas.orgId, orgId))
      .orderBy(desc(growthCustomerPersonas.updatedAt)),
  ]);

  return {
    segments: segments.map((segment) => ({
      ...segment,
      createdAt: segment.createdAt.toISOString(),
      updatedAt: segment.updatedAt.toISOString(),
    })),
    personas: personas.map((persona) => ({
      ...persona,
      updatedAt: persona.updatedAt.toISOString(),
    })),
  };
}

export async function saveGrowthCustomerSegment(formData: FormData): Promise<void> {
  const { orgId, userId } = await requireOrg();
  const name = textField(formData, "name", "Segment name", 120, true);
  const description = textField(formData, "description", "Description", 2_000);
  const industry = textField(formData, "industry", "Industry", 120) || null;
  const companySize = textField(formData, "companySize", "Company size", 120) || null;
  const market = textField(formData, "market", "Market", 120) || null;
  const buyingTriggers = lineList(formData, "buyingTriggers", "Buying triggers");

  const [saved] = await db
    .insert(growthCustomerSegments)
    .values({
      orgId,
      name,
      description,
      industry,
      companySize,
      market,
      buyingTriggers,
      createdBy: userId,
      updatedBy: userId,
    })
    .onConflictDoUpdate({
      target: [growthCustomerSegments.orgId, growthCustomerSegments.name],
      set: {
        description,
        industry,
        companySize,
        market,
        buyingTriggers,
        updatedBy: userId,
        updatedAt: new Date(),
      },
    })
    .returning({ id: growthCustomerSegments.id });

  if (!saved) throw new Error("Customer segment could not be saved");

  await logEvent({
    orgId,
    actorId: userId,
    action: "console.growth.customer_segment.saved",
    resourceType: "growth_customer_segment",
    resourceId: saved.id,
    metadata: { buyingTriggerCount: buyingTriggers.length },
  });
  revalidatePath("/growth");
  revalidatePath("/growth/customer-intelligence");
}

export async function saveGrowthCustomerPersona(formData: FormData): Promise<void> {
  const { orgId, userId } = await requireOrg();
  const segmentId = textField(formData, "segmentId", "Customer segment", 36, true);
  if (!UUID_PATTERN.test(segmentId)) throw new Error("Customer segment id is invalid");

  const [segment] = await db
    .select({ id: growthCustomerSegments.id })
    .from(growthCustomerSegments)
    .where(and(eq(growthCustomerSegments.id, segmentId), eq(growthCustomerSegments.orgId, orgId)))
    .limit(1);
  if (!segment) throw new Error("Customer segment not found in this organisation");

  const productSlug = textField(formData, "productSlug", "Product", 120) || null;
  if (productSlug && !getProductBySlug(productSlug)) {
    throw new Error("Product does not exist in the Product Registry");
  }

  const confidence = textField(formData, "confidence", "Confidence", 10, true);
  const status = textField(formData, "status", "Status", 20, true);
  if (!["low", "medium", "high"].includes(confidence)) throw new Error("Invalid confidence level");
  if (!["draft", "validated", "archived"].includes(status))
    throw new Error("Invalid persona status");

  const name = textField(formData, "name", "Persona name", 120, true);
  const role = textField(formData, "role", "Role", 160);
  const seniority = textField(formData, "seniority", "Seniority", 80) || null;
  const goals = lineList(formData, "goals", "Goals");
  const painPoints = lineList(formData, "painPoints", "Pain points");
  const jobsToBeDone = lineList(formData, "jobsToBeDone", "Jobs to be done");
  const objections = lineList(formData, "objections", "Objections");
  const successCriteria = lineList(formData, "successCriteria", "Success criteria");
  const buyingSignals = lineList(formData, "buyingSignals", "Buying signals");
  const evidenceNotes = textField(formData, "evidenceNotes", "Evidence notes", 4_000);

  const [saved] = await db
    .insert(growthCustomerPersonas)
    .values({
      orgId,
      segmentId,
      productSlug,
      name,
      role,
      seniority,
      goals,
      painPoints,
      jobsToBeDone,
      objections,
      successCriteria,
      buyingSignals,
      evidenceNotes,
      confidence,
      status,
      createdBy: userId,
      updatedBy: userId,
    })
    .onConflictDoUpdate({
      target: [
        growthCustomerPersonas.orgId,
        growthCustomerPersonas.segmentId,
        growthCustomerPersonas.name,
      ],
      set: {
        productSlug,
        role,
        seniority,
        goals,
        painPoints,
        jobsToBeDone,
        objections,
        successCriteria,
        buyingSignals,
        evidenceNotes,
        confidence,
        status,
        updatedBy: userId,
        updatedAt: new Date(),
      },
    })
    .returning({ id: growthCustomerPersonas.id });

  if (!saved) throw new Error("Customer persona could not be saved");

  await logEvent({
    orgId,
    actorId: userId,
    action: "console.growth.customer_persona.saved",
    resourceType: "growth_customer_persona",
    resourceId: saved.id,
    metadata: {
      segmentId,
      productSlug,
      confidence,
      status,
      buyingSignalCount: buyingSignals.length,
    },
  });
  revalidatePath("/growth");
  revalidatePath("/growth/customer-intelligence");
}
