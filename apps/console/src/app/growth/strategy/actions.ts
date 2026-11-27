"use server";

import { and, asc, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireOrg } from "@nexora/auth/server";
import {
  db,
  growthCustomerSegments,
  growthSegmentProductFits,
  growthStrategyRecommendations,
} from "@nexora/database";
import { getProductBySlug } from "@nexora/registry";
import { logEvent } from "@nexora/telemetry";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type FitRow = {
  id: string;
  segmentId: string;
  segmentName: string;
  productSlug: string;
  needAlignmentScore: number | null;
  capabilityCoverageScore: number | null;
  urgencyScore: number | null;
  budgetReadinessScore: number | null;
  buyingCommitteeFitScore: number | null;
  status: string;
  rationale: string;
  evidenceNotes: string;
};

function buildCandidates(fit: FitRow) {
  const confidence = fit.status === "validated" && fit.evidenceNotes.trim() ? "medium" : "low";
  const evidenceSnapshot = {
    fitAssessmentId: fit.id,
    fitStatus: fit.status,
    scores: {
      needAlignment: fit.needAlignmentScore,
      capabilityCoverage: fit.capabilityCoverageScore,
      urgency: fit.urgencyScore,
      budgetReadiness: fit.budgetReadinessScore,
      buyingCommitteeFit: fit.buyingCommitteeFitScore,
    },
    sourceRationale: fit.rationale,
    sourceEvidenceNotes: fit.evidenceNotes,
    generatedBy: "deterministic_rules_v1",
  };
  const candidates: Array<{
    category: string;
    title: string;
    recommendation: string;
    rationale: string;
  }> = [];

  if (
    fit.needAlignmentScore !== null &&
    fit.needAlignmentScore >= 4 &&
    fit.capabilityCoverageScore !== null &&
    fit.capabilityCoverageScore >= 3 &&
    fit.urgencyScore !== null &&
    fit.urgencyScore >= 3
  ) {
    candidates.push({
      category: "segment_priority",
      title: `Validate ${fit.segmentName} as a priority segment`,
      recommendation:
        "Design a small, measurable discovery or pilot experiment for this segment. Define the target outcome and stop conditions before launch.",
      rationale:
        "Need alignment, capability coverage and urgency meet the configured rule thresholds. This is a candidate for validation, not proof of demand.",
    });
  }

  if (
    fit.needAlignmentScore !== null &&
    fit.needAlignmentScore >= 3 &&
    fit.capabilityCoverageScore !== null &&
    fit.capabilityCoverageScore <= 2
  ) {
    candidates.push({
      category: "product_gap",
      title: `Investigate the capability gap for ${fit.segmentName}`,
      recommendation:
        "Compare the segment's documented jobs-to-be-done with current product capabilities. Record the smallest viable gap to validate before committing roadmap capacity.",
      rationale:
        "The segment need is rated at least 3/5 while capability coverage is at most 2/5. The gap requires product-owner review.",
    });
  }

  if (
    fit.urgencyScore === null ||
    fit.budgetReadinessScore === null ||
    fit.buyingCommitteeFitScore === null ||
    fit.status !== "validated"
  ) {
    candidates.push({
      category: "evidence_gap",
      title: `Collect missing evidence for ${fit.segmentName}`,
      recommendation:
        "Run targeted research to resolve unknown urgency, budget readiness, buying roles or unvalidated assumptions. Update the fit assessment only when source notes are available.",
      rationale:
        "At least one decision-relevant criterion is unknown or the source assessment remains a hypothesis. Unknown values are not treated as zero.",
    });
  }

  if (
    fit.needAlignmentScore !== null &&
    fit.needAlignmentScore >= 3 &&
    fit.buyingCommitteeFitScore !== null &&
    fit.buyingCommitteeFitScore <= 2
  ) {
    candidates.push({
      category: "positioning",
      title: `Clarify buying-committee positioning for ${fit.segmentName}`,
      recommendation:
        "Map the evaluator, technical approver and budget owner roles. Tailor value messages to their distinct concerns and validate them in interviews before campaign use.",
      rationale:
        "Need alignment is present, but the buying-committee fit is weak. Messaging and stakeholder assumptions need further validation.",
    });
  }

  return candidates.map((candidate) => ({
    ...candidate,
    confidence,
    evidenceSnapshot,
  }));
}

export async function listGrowthStrategyRecommendations() {
  const { orgId } = await requireOrg();
  const rows = await db
    .select({
      id: growthStrategyRecommendations.id,
      sourceFitId: growthStrategyRecommendations.sourceFitId,
      segmentId: growthStrategyRecommendations.segmentId,
      segmentName: growthCustomerSegments.name,
      productSlug: growthStrategyRecommendations.productSlug,
      category: growthStrategyRecommendations.category,
      title: growthStrategyRecommendations.title,
      recommendation: growthStrategyRecommendations.recommendation,
      rationale: growthStrategyRecommendations.rationale,
      evidenceSnapshot: growthStrategyRecommendations.evidenceSnapshot,
      confidence: growthStrategyRecommendations.confidence,
      status: growthStrategyRecommendations.status,
      decisionNote: growthStrategyRecommendations.decisionNote,
      updatedAt: growthStrategyRecommendations.updatedAt,
    })
    .from(growthStrategyRecommendations)
    .innerJoin(
      growthCustomerSegments,
      and(
        eq(growthCustomerSegments.id, growthStrategyRecommendations.segmentId),
        eq(growthCustomerSegments.orgId, orgId),
      ),
    )
    .where(eq(growthStrategyRecommendations.orgId, orgId))
    .orderBy(asc(growthStrategyRecommendations.status), desc(growthStrategyRecommendations.updatedAt));

  return rows.map((row) => ({
    ...row,
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function generateGrowthStrategyRecommendations(): Promise<number> {
  const { orgId, userId } = await requireOrg();
  const fits = await db
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
    })
    .from(growthSegmentProductFits)
    .innerJoin(
      growthCustomerSegments,
      and(
        eq(growthCustomerSegments.id, growthSegmentProductFits.segmentId),
        eq(growthCustomerSegments.orgId, orgId),
      ),
    )
    .where(eq(growthSegmentProductFits.orgId, orgId));

  let generated = 0;
  for (const fit of fits) {
    if (!getProductBySlug(fit.productSlug)) continue;
    const candidates = buildCandidates(fit);
    for (const candidate of candidates) {
      await db
        .insert(growthStrategyRecommendations)
        .values({
          orgId,
          sourceFitId: fit.id,
          segmentId: fit.segmentId,
          productSlug: fit.productSlug,
          ...candidate,
          status: "draft",
          createdBy: userId,
          updatedBy: userId,
        })
        .onConflictDoUpdate({
          target: [
            growthStrategyRecommendations.orgId,
            growthStrategyRecommendations.sourceFitId,
            growthStrategyRecommendations.category,
          ],
          set: {
            title: candidate.title,
            recommendation: candidate.recommendation,
            rationale: candidate.rationale,
            evidenceSnapshot: candidate.evidenceSnapshot,
            confidence: candidate.confidence,
            updatedBy: userId,
            updatedAt: new Date(),
          },
        });
      generated += 1;
    }
  }

  await logEvent({
    orgId,
    actorId: userId,
    action: "console.growth.strategy_recommendations.generated",
    resourceType: "growth_strategy_recommendation",
    metadata: { fitAssessmentsReviewed: fits.length, recommendationsUpserted: generated },
  });
  revalidatePath("/growth/strategy");
  return generated;
}

export async function decideGrowthStrategyRecommendation(formData: FormData): Promise<void> {
  const { orgId, userId } = await requireOrg();
  const id = String(formData.get("recommendationId") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  const decisionNote = String(formData.get("decisionNote") ?? "").trim();

  if (!UUID_PATTERN.test(id)) throw new Error("Recommendation id is invalid");
  if (!["accepted", "rejected", "implemented"].includes(status)) {
    throw new Error("Unsupported recommendation decision");
  }
  if (decisionNote.length > 2_000) throw new Error("Decision note exceeds 2000 characters");

  const [updated] = await db
    .update(growthStrategyRecommendations)
    .set({ status, decisionNote, updatedBy: userId, updatedAt: new Date() })
    .where(
      and(
        eq(growthStrategyRecommendations.id, id),
        eq(growthStrategyRecommendations.orgId, orgId),
      ),
    )
    .returning({ id: growthStrategyRecommendations.id });

  if (!updated) throw new Error("Recommendation not found in this organisation");

  await logEvent({
    orgId,
    actorId: userId,
    action: "console.growth.strategy_recommendation.decided",
    resourceType: "growth_strategy_recommendation",
    resourceId: updated.id,
    metadata: { status, hasDecisionNote: Boolean(decisionNote) },
  });
  revalidatePath("/growth/strategy");
  revalidatePath("/growth");
}
