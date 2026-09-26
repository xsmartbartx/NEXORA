"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@nexora/auth/server";
import { resumeProduct, suspendProduct } from "@nexora/admin";

export async function suspendProductAction(
  orgId: string,
  product: string,
  formData: FormData,
): Promise<void> {
  const { userId } = await requireAdmin();
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) throw new Error("A reason is required to suspend a product.");

  await suspendProduct(orgId, product, reason, userId);
  revalidatePath(`/admin/${orgId}`);
  revalidatePath("/admin");
}

export async function resumeProductAction(orgId: string, product: string): Promise<void> {
  const { userId } = await requireAdmin();
  await resumeProduct(orgId, product, userId);
  revalidatePath(`/admin/${orgId}`);
  revalidatePath("/admin");
}
