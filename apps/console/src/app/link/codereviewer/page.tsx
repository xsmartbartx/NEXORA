import type { Metadata } from "next";
import { requireOrg } from "@nexora/auth/server";
import { codereviewerUrl, getOrgPlan, isCodeReviewerSyncConfigured } from "@nexora/billing";
import { buttonVariants, cn } from "@nexora/ui";
import { parseLinkRequest } from "@/lib/codereviewer-link";
import { confirmCodeReviewerLink } from "./actions";
import { organisationName } from "./organisation-name";

export const metadata: Metadata = {
  title: "Link CodeReviewer",
};

/**
 * Where CodeReviewer sends someone who wants to bill a GitHub account through
 * this organisation (ADR-0015). The GitHub side was proven in CodeReviewer; this
 * page asks for the organisation admin's consent.
 */
export default async function LinkCodeReviewerPage(props: PageProps<"/link/codereviewer">) {
  const { orgId, orgRole } = await requireOrg();
  const request = parseLinkRequest(await props.searchParams);
  const back = request
    ? `${codereviewerUrl()}/dashboard/${encodeURIComponent(request.login)}/billing`
    : codereviewerUrl();

  let body: React.ReactNode;
  if (!request) {
    body = <p>This link request is incomplete. Start again from the account in CodeReviewer.</p>;
  } else if (!isCodeReviewerSyncConfigured()) {
    body = <p>Linking CodeReviewer accounts is not switched on for NEXORA yet.</p>;
  } else if (orgRole !== "org:admin") {
    body = (
      <p>
        Only an admin of this organisation can link a CodeReviewer account to it. Ask an admin to
        start the link from CodeReviewer, or switch to an organisation you administer.
      </p>
    );
  } else {
    const [orgName, plan] = await Promise.all([
      organisationName(orgId),
      getOrgPlan(orgId, "codereviewer"),
    ]);
    body = (
      <>
        <p>
          Bill the GitHub account <strong className="text-foreground">{request.login}</strong>{" "}
          through <strong className="text-foreground">{orgName}</strong>. Its CodeReviewer plan
          becomes this organisation&rsquo;s, which is <strong>{plan.name}</strong> today; change it
          on the Billing page. If the account has its own CodeReviewer subscription, the higher plan
          applies until one is cancelled.
        </p>
        <p className="mt-3">
          The account&rsquo;s owner, or whoever installed CodeReviewer on it, can unlink it in
          CodeReviewer at any time.
        </p>
        <form action={confirmCodeReviewerLink} className="mt-8 flex flex-wrap gap-3">
          <input type="hidden" name="account" value={request.accountId} />
          <input type="hidden" name="login" value={request.login} />
          <input type="hidden" name="nonce" value={request.nonce} />
          <button type="submit" className={cn(buttonVariants())}>
            Link {request.login}
          </button>
          <a href={back} className={cn(buttonVariants({ variant: "secondary" }))}>
            Cancel
          </a>
        </form>
      </>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        CodeReviewer
      </span>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Link a GitHub account</h1>
      <div className="mt-4 text-muted-foreground">{body}</div>
    </div>
  );
}
