"use server";

import { requireOrg } from "@nexora/auth/server";
import { checkEntitlement } from "@nexora/entitlements";
import { logEvent } from "@nexora/telemetry";
import { parseResourcesInput, scanResources, type ScanResult } from "@/lib/scan";

const consoleUrl = process.env.NEXT_PUBLIC_CONSOLE_URL ?? "https://console.onenexora.com";

export async function runScan(formData: FormData): Promise<ScanResult> {
  // Org selection lives in Console, not duplicated per product (§6.1: one account surface).
  const { userId, orgId } = await requireOrg({ chooseOrgUrl: `${consoleUrl}/select-organization` });

  const entitlement = await checkEntitlement(orgId, "cspm.scan");
  if (!entitlement.allowed) {
    throw new Error(entitlement.reason ?? "Your organisation is not entitled to run a scan.");
  }

  const raw = String(formData.get("resources") ?? "");
  if (!raw.trim()) throw new Error("Paste your resource description first.");

  const resources = parseResourcesInput(raw);
  const result = scanResources(resources);

  await logEvent({
    orgId,
    actorId: userId,
    action: "cspm.scan.completed",
    resourceType: "resource_list",
    metadata: { totalResources: result.totalResources, findingCount: result.findings.length },
  });

  return result;
}
