"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@nexora/auth/server";
import {
  addCost,
  endCost,
  markTaskDone,
  parseDollarsToCents,
  validateCost,
  type CostInput,
} from "@nexora/admin";

const PATH = "/admin/control-center";

// Each action re-checks admin itself: a server action is a public POST
// endpoint, so the page's own gate protects none of them.

export async function addCostAction(formData: FormData): Promise<{ error: string | null }> {
  const { userId } = await requireAdmin();

  let cost: CostInput;
  try {
    cost = validateCost({
      vendor: String(formData.get("vendor") ?? ""),
      label: String(formData.get("label") ?? ""),
      amountCents: parseDollarsToCents(String(formData.get("amount") ?? "")),
      interval: formData.get("interval") === "year" ? "year" : "month",
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "That cost isn't valid." };
  }

  await addCost(cost, userId);
  revalidatePath(PATH);
  return { error: null };
}

export async function endCostAction(id: string): Promise<void> {
  const { userId } = await requireAdmin();
  await endCost(id, userId);
  revalidatePath(PATH);
}

export async function markTaskDoneAction(taskId: string): Promise<void> {
  const { userId } = await requireAdmin();
  await markTaskDone(taskId, userId);
  revalidatePath(PATH);
}
