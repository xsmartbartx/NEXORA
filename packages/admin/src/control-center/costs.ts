import { desc, eq, isNull } from "drizzle-orm";
import { auditEvents, db, opsCosts, type OpsCost } from "@nexora/database";

export type CostInterval = "month" | "year";

export interface CostInput {
  vendor: string;
  label: string;
  amountCents: number;
  interval: CostInterval;
}

/** "12.50" -> 1250. Strict on purpose: this is money typed by hand, and a silently-wrong parse is worse than a refusal. */
export function parseDollarsToCents(raw: string): number {
  const text = raw.trim().replace(/^\$/, "");
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(text)) {
    throw new Error("Enter an amount like 12 or 12.50 (US dollars).");
  }
  const cents = Math.round(Number(text) * 100);
  if (cents <= 0) throw new Error("The amount must be greater than zero.");
  return cents;
}

export function validateCost(input: CostInput): CostInput {
  const vendor = input.vendor.trim();
  const label = input.label.trim();
  if (!vendor || vendor.length > 60) throw new Error("Vendor is required (60 characters max).");
  if (label.length > 120) throw new Error("Label is 120 characters max.");
  if (input.interval !== "month" && input.interval !== "year") {
    throw new Error("Interval must be month or year.");
  }
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    throw new Error("The amount must be greater than zero.");
  }
  return { vendor, label, amountCents: input.amountCents, interval: input.interval };
}

export function monthlyCost(cost: Pick<OpsCost, "amountCents" | "interval">): number {
  return cost.interval === "year" ? Math.round(cost.amountCents / 12) : cost.amountCents;
}

export interface CostSummary {
  entries: OpsCost[];
  monthlyCents: number;
  byVendor: { vendor: string; monthlyCents: number }[];
}

export function summarizeCosts(entries: OpsCost[]): CostSummary {
  const byVendor = new Map<string, number>();
  let total = 0;
  for (const entry of entries) {
    const monthly = monthlyCost(entry);
    total += monthly;
    byVendor.set(entry.vendor, (byVendor.get(entry.vendor) ?? 0) + monthly);
  }
  return {
    entries,
    monthlyCents: total,
    byVendor: [...byVendor.entries()]
      .map(([vendor, monthlyCents]) => ({ vendor, monthlyCents }))
      .sort((a, b) => b.monthlyCents - a.monthlyCents),
  };
}

/** Costs that haven't been ended. */
export async function collectCosts(): Promise<CostSummary> {
  const entries = await db
    .select()
    .from(opsCosts)
    .where(isNull(opsCosts.endedAt))
    .orderBy(desc(opsCosts.createdAt));
  return summarizeCosts(entries);
}

async function audit(actorId: string, action: string, resourceId: string, metadata: object) {
  await db.insert(auditEvents).values({
    orgId: null,
    actorId,
    action,
    resourceType: "ops_cost",
    resourceId,
    metadata,
  });
}

export async function addCost(input: CostInput, actorId: string): Promise<void> {
  const cost = validateCost(input);
  const [row] = await db
    .insert(opsCosts)
    .values({ ...cost, createdBy: actorId })
    .returning({ id: opsCosts.id });
  await audit(actorId, "admin.cost.added", row!.id, cost);
}

/** Stops counting a cost from now on; the row is kept so past months stay explainable. */
export async function endCost(id: string, actorId: string): Promise<void> {
  const [row] = await db
    .update(opsCosts)
    .set({ endedAt: new Date() })
    .where(eq(opsCosts.id, id))
    .returning({ id: opsCosts.id, vendor: opsCosts.vendor });
  if (!row) throw new Error("No such cost entry.");
  await audit(actorId, "admin.cost.ended", row.id, { vendor: row.vendor });
}
