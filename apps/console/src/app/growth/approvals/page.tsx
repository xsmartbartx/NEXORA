import type { Metadata } from "next";
import { requireOrg } from "@nexora/auth/server";
import {
  approveGrowthApproval,
  listPendingGrowthApprovals,
  rejectGrowthApproval,
} from "../actions";

export const metadata: Metadata = {
  title: "Growth approvals",
};

export default async function GrowthApprovalsPage() {
  await requireOrg();
  const approvals = await listPendingGrowthApprovals();

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <p className="text-sm font-medium text-link">Growth Engine</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Approvals</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Review requests are bound to an immutable content version. Approval records a decision only;
        external publishing and outbound delivery remain separate, unimplemented actions.
      </p>

      <div className="mt-8 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Pending review</h2>
        <span className="text-xs text-muted-foreground">{approvals.length} pending</span>
      </div>

      {approvals.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-border p-8 text-center">
          <p className="font-medium">No pending approvals</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Submit a content version for review from Content Studio.
          </p>
        </div>
      ) : (
        <div className="mt-4 grid gap-4">
          {approvals.map((approval) => (
            <article key={approval.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{approval.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {approval.channel} · Version {approval.version} · Requested{" "}
                    {new Intl.DateTimeFormat("en", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(approval.requestedAt))}
                  </p>
                </div>
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs">Pending</span>
              </div>
              <pre className="mt-4 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-muted/50 p-4 text-sm">
                {approval.body}
              </pre>
              <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto]">
                <form action={approveGrowthApproval} className="contents">
                  <input type="hidden" name="approvalId" value={approval.id} />
                  <input
                    name="reviewNote"
                    maxLength={2000}
                    placeholder="Optional review note"
                    className="min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                  <button
                    type="submit"
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                  >
                    Approve version
                  </button>
                </form>
                <form action={rejectGrowthApproval}>
                  <input type="hidden" name="approvalId" value={approval.id} />
                  <button
                    type="submit"
                    className="rounded-lg border border-border px-4 py-2 text-sm font-medium"
                  >
                    Reject
                  </button>
                </form>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
