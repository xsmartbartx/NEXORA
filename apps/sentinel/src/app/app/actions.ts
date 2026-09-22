"use server";

import { requireOrg } from "@nexora/auth/server";
import { checkEntitlement } from "@nexora/entitlements";
import { logEvent } from "@nexora/telemetry";
import { analyzeLogSample, type AnalyzeResult } from "@/lib/analyze";

const consoleUrl = process.env.NEXT_PUBLIC_CONSOLE_URL ?? "https://console.onenexora.com";

export async function runAnalysis(formData: FormData): Promise<AnalyzeResult> {
  // Org selection lives in Console, not duplicated per product (§6.1: one account surface).
  const { userId, orgId } = await requireOrg({ chooseOrgUrl: `${consoleUrl}/select-organization` });

  const entitlement = await checkEntitlement(orgId, "sentinel.scan");
  if (!entitlement.allowed) {
    throw new Error(entitlement.reason ?? "Your organisation is not entitled to run a scan.");
  }

  const raw = String(formData.get("logs") ?? "");
  if (!raw.trim()) throw new Error("Paste a log sample first.");

  const result = analyzeLogSample(raw);

  await logEvent({
    orgId,
    actorId: userId,
    action: "sentinel.scan.completed",
    resourceType: "log_sample",
    metadata: { totalLines: result.totalLines, findingCount: result.findings.length },
  });

  return result;
}
