import type { Metadata } from "next";
import Link from "next/link";
import { getAllProducts } from "@nexora/registry";
import {
  decideGrowthStrategyRecommendation,
  generateGrowthStrategyRecommendations,
  listGrowthStrategyRecommendations,
} from "./actions";

export const metadata: Metadata = {
  title: "Growth Strategy Intelligence",
};

const categoryLabels: Record<string, string> = {
  segment_priority: "Segment priority",
  product_gap: "Product gap",
  evidence_gap: "Evidence gap",
  positioning: "Positioning",
};

const statusLabels: Record<string, string> = {
  draft: "Needs review",
  accepted: "Accepted",
  rejected: "Rejected",
  implemented: "Implemented",
};

function scoreSummary(snapshot: Record<string, unknown>): string {
  const scores = snapshot.scores as Record<string, number | null> | undefined;
  if (!scores) return "No score snapshot";
  const labels: Record<string, string> = {
    needAlignment: "Need",
    capabilityCoverage: "Capability",
    urgency: "Urgency",
    budgetReadiness: "Budget",
    buyingCommitteeFit: "Committee",
  };
  return Object.entries(labels)
    .map(([key, label]) => {
      const value = scores[key];
      return `${label}: ${value === null || value === undefined ? "unknown" : `${value}/5`}`;
    })
    .join(" · ");
}

export default async function GrowthStrategyPage() {
  const [recommendations, products] = await Promise.all([
    listGrowthStrategyRecommendations(),
    Promise.resolve(getAllProducts()),
  ]);
  const productNames = new Map(products.map((product) => [product.slug, product.name]));
  const pendingCount = recommendations.filter((item) => item.status === "draft").length;

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <Link href="/growth" className="text-sm font-medium text-link hover:underline">
        Growth Engine
      </Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Growth Strategy Intelligence</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Turn product–segment fit assessments into explainable strategy candidates. Every
            recommendation remains a draft until a person reviews and records a decision.
          </p>
        </div>
        <span className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground">
          {pendingCount} awaiting review
        </span>
      </div>

      <div className="mt-6 rounded-xl border border-border bg-muted/30 p-4 text-sm">
        <p className="font-medium">Decision boundary</p>
        <p className="mt-1 text-muted-foreground">
          The engine uses deterministic rules over saved fit assessments. It does not infer market
          size, demand, revenue or conversion probability. Generated recommendations are hypotheses;
          they do not launch campaigns, change product roadmaps or contact customers.
        </p>
      </div>

      <section className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-5">
        <div>
          <h2 className="font-semibold">Generate strategy candidates</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Review existing fit assessments and create or refresh recommendations. Existing human
            decisions are preserved when a candidate is refreshed.
          </p>
        </div>
        <form action={generateGrowthStrategyRecommendations}>
          <button
            type="submit"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Generate recommendations
          </button>
        </form>
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Recommendation register</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Organisation-scoped, traceable recommendations linked to their source fit assessment.
            </p>
          </div>
          <span className="text-xs text-muted-foreground">
            {recommendations.length} recommendations
          </span>
        </div>

        {recommendations.length > 0 ? (
          <div className="mt-4 grid gap-4">
            {recommendations.map((item) => (
              <article key={item.id} className="rounded-xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                    {categoryLabels[item.category] ?? item.category}
                  </span>
                  <span className="rounded-full border border-border px-2.5 py-1 text-xs">
                    {statusLabels[item.status] ?? item.status}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Confidence: {item.confidence}
                  </span>
                </div>
                <h3 className="mt-3 text-base font-semibold">{item.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.segmentName} · {productNames.get(item.productSlug) ?? item.productSlug}
                </p>
                <p className="mt-4 text-sm leading-6">{item.recommendation}</p>
                <div className="mt-4 rounded-lg bg-muted/40 p-3">
                  <p className="text-xs font-medium">Why this was suggested</p>
                  <p className="mt-1 text-sm text-muted-foreground">{item.rationale}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Source scores: {scoreSummary(item.evidenceSnapshot)}
                  </p>
                </div>
                {item.decisionNote ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Decision note: {item.decisionNote}
                  </p>
                ) : null}
                {item.status !== "implemented" ? (
                  <form
                    action={decideGrowthStrategyRecommendation}
                    className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-[1fr_auto]"
                  >
                    <input type="hidden" name="recommendationId" value={item.id} />
                    <label className="grid gap-1 text-xs text-muted-foreground">
                      Decision note (optional)
                      <input
                        name="decisionNote"
                        maxLength={2000}
                        defaultValue={item.decisionNote}
                        className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                        placeholder="Reason, owner or next validation step"
                      />
                    </label>
                    <div className="flex flex-wrap items-end gap-2">
                      <button
                        type="submit"
                        name="status"
                        value="accepted"
                        className="rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-muted"
                      >
                        Accept
                      </button>
                      <button
                        type="submit"
                        name="status"
                        value="rejected"
                        className="rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-muted"
                      >
                        Reject
                      </button>
                      <button
                        type="submit"
                        name="status"
                        value="implemented"
                        className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
                      >
                        Mark implemented
                      </button>
                    </div>
                  </form>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No recommendations yet. Add product–segment fit assessments, then generate strategy
            candidates.
          </p>
        )}
      </section>
    </div>
  );
}
