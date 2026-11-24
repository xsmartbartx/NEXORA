"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireOrg } from "@nexora/auth/server";
import {
  db,
  growthApprovals,
  growthCampaigns,
  growthContentItems,
  growthContentVersions,
} from "@nexora/database";
import { logEvent } from "@nexora/telemetry";
import { getProductBySlug } from "@nexora/registry";

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function requiredText(value: FormDataEntryValue | null, label: string, max = 500): string {
  const result = String(value ?? "").trim();
  if (!result) throw new Error(`${label} is required`);
  if (result.length > max) throw new Error(`${label} is too long`);
  return result;
}

function optionalDate(value: FormDataEntryValue | null, label: string): Date | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) throw new Error(`${label} must be a valid date`);
  return date;
}

export async function listGrowthCampaigns() {
  const { orgId } = await requireOrg();
  const rows = await db
    .select()
    .from(growthCampaigns)
    .where(eq(growthCampaigns.orgId, orgId))
    .orderBy(desc(growthCampaigns.updatedAt));

  return rows.map((row) => ({
    ...row,
    startsAt: row.startsAt?.toISOString() ?? null,
    endsAt: row.endsAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function createGrowthCampaign(formData: FormData) {
  const { orgId, userId } = await requireOrg();
  const name = requiredText(formData.get("name"), "Campaign name", 160);
  const objective = requiredText(formData.get("objective"), "Objective", 2_000);
  const startsAt = optionalDate(formData.get("startsAt"), "Start date");
  const endsAt = optionalDate(formData.get("endsAt"), "End date");
  if (startsAt && endsAt && endsAt < startsAt) {
    throw new Error("End date must be on or after the start date");
  }

  const rawBudget = String(formData.get("budgetCents") ?? "").trim();
  const budgetCents = rawBudget ? Number(rawBudget) : null;
  if (
    budgetCents !== null &&
    (!Number.isSafeInteger(budgetCents) || budgetCents < 0 || budgetCents > 2_000_000_000)
  ) {
    throw new Error("Budget must be a non-negative whole number of cents");
  }

  const currency = String(formData.get("currency") ?? "USD").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Currency must be a three-letter code");

  const [created] = await db
    .insert(growthCampaigns)
    .values({
      orgId,
      name,
      objective,
      ownerId: userId,
      startsAt,
      endsAt,
      budgetCents,
      currency,
    })
    .returning({ id: growthCampaigns.id });

  if (!created) throw new Error("Campaign could not be created");

  await logEvent({
    orgId,
    actorId: userId,
    action: "console.growth.campaign.created",
    resourceType: "growth_campaign",
    resourceId: created.id,
    metadata: { currency, hasBudget: budgetCents !== null },
  });

  revalidatePath("/growth");
  revalidatePath("/growth/campaigns");
  return created.id;
}

export async function createGrowthContentDraft(formData: FormData) {
  const { orgId, userId } = await requireOrg();
  const title = requiredText(formData.get("title"), "Content title", 200);
  const body = requiredText(formData.get("body"), "Content body", 50_000);
  const contentType = requiredText(formData.get("contentType"), "Content type", 40);
  const channel = requiredText(formData.get("channel"), "Channel", 40);
  const campaignId = String(formData.get("campaignId") ?? "").trim() || null;
  const productSlug = String(formData.get("productSlug") ?? "").trim() || null;

  if (!["social_post", "article", "email", "video_script", "landing_page"].includes(contentType)) {
    throw new Error("Unsupported content type");
  }
  if (!["linkedin", "youtube", "website", "email", "x", "other"].includes(channel)) {
    throw new Error("Unsupported channel");
  }
  if (productSlug && !getProductBySlug(productSlug)) {
    throw new Error("Product does not exist in the Product Registry");
  }
  if (campaignId) {
    if (!isUuid(campaignId)) throw new Error("Campaign id is invalid");
    const [campaign] = await db
      .select({ id: growthCampaigns.id })
      .from(growthCampaigns)
      .where(and(eq(growthCampaigns.id, campaignId), eq(growthCampaigns.orgId, orgId)))
      .limit(1);
    if (!campaign) throw new Error("Campaign not found in this organisation");
  }

  const created = await db.transaction(async (tx) => {
    const [item] = await tx
      .insert(growthContentItems)
      .values({
        orgId,
        campaignId,
        productSlug,
        title,
        contentType,
        channel,
        createdBy: userId,
      })
      .returning({ id: growthContentItems.id });

    if (!item) throw new Error("Content item could not be created");

    const [version] = await tx
      .insert(growthContentVersions)
      .values({
        orgId,
        contentItemId: item.id,
        version: 1,
        body,
        sourceRefs: [],
        createdBy: userId,
      })
      .returning({ id: growthContentVersions.id });

    if (!version) throw new Error("Content version could not be created");
    return { itemId: item.id, versionId: version.id };
  });

  await logEvent({
    orgId,
    actorId: userId,
    action: "console.growth.content.draft_created",
    resourceType: "growth_content_item",
    resourceId: created.itemId,
    metadata: { versionId: created.versionId, channel, contentType },
  });

  revalidatePath("/growth");
  revalidatePath("/growth/content");
  return created;
}

export async function requestGrowthApproval(contentVersionId: string) {
  const { orgId, userId } = await requireOrg();
  if (!isUuid(contentVersionId)) throw new Error("Content version id is invalid");
  const [version] = await db
    .select({
      id: growthContentVersions.id,
      contentItemId: growthContentVersions.contentItemId,
    })
    .from(growthContentVersions)
    .where(
      and(
        eq(growthContentVersions.id, contentVersionId),
        eq(growthContentVersions.orgId, orgId),
      ),
    )
    .limit(1);

  if (!version) throw new Error("Content version not found in this organisation");

  const [approval] = await db
    .insert(growthApprovals)
    .values({ orgId, contentVersionId: version.id, requestedBy: userId })
    .returning({ id: growthApprovals.id });

  if (!approval) throw new Error("Approval request could not be created");

  await db
    .update(growthContentItems)
    .set({ status: "in_review", updatedAt: new Date() })
    .where(
      and(
        eq(growthContentItems.id, version.contentItemId),
        eq(growthContentItems.orgId, orgId),
      ),
    );

  await logEvent({
    orgId,
    actorId: userId,
    action: "console.growth.approval.requested",
    resourceType: "growth_approval",
    resourceId: approval.id,
    metadata: { contentVersionId: version.id },
  });

  revalidatePath("/growth");
  revalidatePath("/growth/approvals");
  revalidatePath("/growth/content");
  return approval.id;
}

export async function reviewGrowthApproval(
  approvalId: string,
  decision: "approved" | "rejected",
  reviewNote = "",
) {
  const { orgId, userId } = await requireOrg();
  if (decision !== "approved" && decision !== "rejected") {
    throw new Error("Unsupported approval decision");
  }
  if (typeof reviewNote !== "string") throw new Error("Review note must be text");
  if (!isUuid(approvalId)) throw new Error("Approval id is invalid");
  const [approval] = await db
    .select({
      id: growthApprovals.id,
      contentVersionId: growthApprovals.contentVersionId,
    })
    .from(growthApprovals)
    .where(
      and(
        eq(growthApprovals.id, approvalId),
        eq(growthApprovals.orgId, orgId),
        eq(growthApprovals.status, "pending"),
      ),
    )
    .limit(1);

  if (!approval) throw new Error("Pending approval not found in this organisation");

  const [version] = await db
    .select({ contentItemId: growthContentVersions.contentItemId })
    .from(growthContentVersions)
    .where(
      and(
        eq(growthContentVersions.id, approval.contentVersionId),
        eq(growthContentVersions.orgId, orgId),
      ),
    )
    .limit(1);

  if (!version) throw new Error("Approved content version no longer exists");

  const [latestVersion] = await db
    .select({ id: growthContentVersions.id })
    .from(growthContentVersions)
    .where(
      and(
        eq(growthContentVersions.contentItemId, version.contentItemId),
        eq(growthContentVersions.orgId, orgId),
      ),
    )
    .orderBy(desc(growthContentVersions.version))
    .limit(1);

  await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(growthApprovals)
      .set({
        status: decision,
        reviewedBy: userId,
        reviewNote: reviewNote.trim().slice(0, 2_000) || null,
        reviewedAt: new Date(),
      })
      .where(
        and(
          eq(growthApprovals.id, approval.id),
          eq(growthApprovals.orgId, orgId),
          eq(growthApprovals.status, "pending"),
        ),
      )
      .returning({ id: growthApprovals.id });

    if (!updated) throw new Error("Approval was already reviewed");

    if (latestVersion?.id === approval.contentVersionId) {
      await tx
        .update(growthContentItems)
        .set({ status: decision === "approved" ? "approved" : "draft", updatedAt: new Date() })
        .where(
          and(
            eq(growthContentItems.id, version.contentItemId),
            eq(growthContentItems.orgId, orgId),
          ),
        );
    }
  });

  await logEvent({
    orgId,
    actorId: userId,
    action: `console.growth.approval.${decision}`,
    resourceType: "growth_approval",
    resourceId: approval.id,
    metadata: { contentVersionId: approval.contentVersionId },
  });

  revalidatePath("/growth");
  revalidatePath("/growth/approvals");
  revalidatePath("/growth/content");
}

export async function listGrowthContentItems() {
  const { orgId } = await requireOrg();
  const rows = await db
    .select({
      id: growthContentItems.id,
      title: growthContentItems.title,
      contentType: growthContentItems.contentType,
      channel: growthContentItems.channel,
      status: growthContentItems.status,
      updatedAt: growthContentItems.updatedAt,
      version: growthContentVersions.version,
      versionId: growthContentVersions.id,
    })
    .from(growthContentItems)
    .leftJoin(
      growthContentVersions,
      and(
        eq(growthContentVersions.contentItemId, growthContentItems.id),
        eq(growthContentVersions.orgId, orgId),
      ),
    )
    .where(eq(growthContentItems.orgId, orgId))
    .orderBy(desc(growthContentItems.updatedAt));

  return rows.map((row) => ({
    ...row,
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function listPendingGrowthApprovals() {
  const { orgId } = await requireOrg();
  const rows = await db
    .select({
      id: growthApprovals.id,
      contentVersionId: growthApprovals.contentVersionId,
      requestedAt: growthApprovals.requestedAt,
      requestedBy: growthApprovals.requestedBy,
      title: growthContentItems.title,
      channel: growthContentItems.channel,
      version: growthContentVersions.version,
      body: growthContentVersions.body,
    })
    .from(growthApprovals)
    .innerJoin(
      growthContentVersions,
      and(
        eq(growthContentVersions.id, growthApprovals.contentVersionId),
        eq(growthContentVersions.orgId, orgId),
      ),
    )
    .innerJoin(
      growthContentItems,
      and(
        eq(growthContentItems.id, growthContentVersions.contentItemId),
        eq(growthContentItems.orgId, orgId),
      ),
    )
    .where(and(eq(growthApprovals.orgId, orgId), eq(growthApprovals.status, "pending")))
    .orderBy(desc(growthApprovals.requestedAt));

  return rows.map((row) => ({
    ...row,
    requestedAt: row.requestedAt.toISOString(),
  }));
}

export async function approveGrowthApproval(formData: FormData) {
  const approvalId = requiredText(formData.get("approvalId"), "Approval id", 64);
  await reviewGrowthApproval(approvalId, "approved", String(formData.get("reviewNote") ?? ""));
}

export async function rejectGrowthApproval(formData: FormData) {
  const approvalId = requiredText(formData.get("approvalId"), "Approval id", 64);
  await reviewGrowthApproval(approvalId, "rejected", String(formData.get("reviewNote") ?? ""));
}

export async function requestGrowthApprovalFromForm(formData: FormData) {
  const versionId = requiredText(formData.get("contentVersionId"), "Content version id", 64);
  await requestGrowthApproval(versionId);
}

export async function createGrowthCampaignFromForm(formData: FormData): Promise<void> {
  await createGrowthCampaign(formData);
}

export async function createGrowthContentDraftFromForm(formData: FormData): Promise<void> {
  await createGrowthContentDraft(formData);
}
