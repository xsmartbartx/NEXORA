"use server";

import { requireOrg } from "@nexora/auth/server";
import { checkEntitlement } from "@nexora/entitlements";
import { logEvent } from "@nexora/telemetry";
import { relayChatRequest } from "@/lib/relay";

const consoleUrl = process.env.NEXT_PUBLIC_CONSOLE_URL ?? "https://console.onenexora.com";

export async function runPlaygroundChat(formData: FormData): Promise<{ text: string }> {
  // Org selection lives in Console, not duplicated per product (§6.1: one account surface).
  const { userId, orgId } = await requireOrg({ chooseOrgUrl: `${consoleUrl}/select-organization` });

  const entitlement = await checkEntitlement(orgId, "gateway.proxy");
  if (!entitlement.allowed) {
    throw new Error(entitlement.reason ?? "Your organisation is not entitled to use Gateway.");
  }

  const prompt = String(formData.get("prompt") ?? "").trim();
  if (!prompt) throw new Error("Enter a prompt first.");

  const result = await relayChatRequest({ messages: [{ role: "user", content: prompt }] });

  await logEvent({
    orgId,
    actorId: userId,
    action: "gateway.proxy.completed",
    resourceType: "chat_request",
    outcome: result.ok ? "success" : "failure",
    metadata: { status: result.status },
  });

  if (!result.ok) {
    const message =
      typeof result.raw === "object" && result.raw !== null && "error" in result.raw
        ? String((result.raw as { error: unknown }).error)
        : "The upstream request failed.";
    throw new Error(message);
  }

  return { text: result.text ?? JSON.stringify(result.raw) };
}
