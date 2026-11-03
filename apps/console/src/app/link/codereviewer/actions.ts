"use server";

import { redirect } from "next/navigation";
import { requireOrg } from "@nexora/auth/server";
import { codereviewerLinkUrl, getOrgPlan } from "@nexora/billing";
import { codereviewerPlanId, parseLinkRequest } from "@/lib/codereviewer-link";
import { organisationName } from "./organisation-name";

/**
 * An organisation admin's consent to bill a CodeReviewer account through this
 * organisation. Signs a short-lived grant and sends the browser back to
 * CodeReviewer, which applies it only together with the cookie nonce of the
 * request that same browser started there.
 */
export async function confirmCodeReviewerLink(formData: FormData): Promise<void> {
  const { orgId, orgRole } = await requireOrg();
  if (orgRole !== "org:admin") {
    throw new Error("Only organisation admins can link a CodeReviewer account.");
  }
  const request = parseLinkRequest(formData);
  if (!request) throw new Error("Malformed link request.");

  const [orgName, plan] = await Promise.all([
    organisationName(orgId),
    getOrgPlan(orgId, "codereviewer"),
  ]);
  redirect(
    codereviewerLinkUrl({
      orgId,
      orgName,
      accountId: request.accountId,
      nonce: request.nonce,
      planId: codereviewerPlanId(plan.id),
    }),
  );
}
