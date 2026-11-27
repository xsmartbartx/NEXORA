import type { Metadata } from "next";
import Link from "next/link";
import { requireOrg } from "@nexora/auth/server";
import { getAllProducts } from "@nexora/registry";
import { db, growthCustomerSegments } from "@nexora/database";
import { asc, eq } from "drizzle-orm";
import { listGrowthProductSegmentFits, saveGrowthProductSegmentFit } from "./actions";

export const metadata: Metadata = {
  title: "Product–Segment Fit",
};

const criteria = [
  [
    "needAlignmentScore",
    "Need alignment",
    "How strongly does the segment's documented problem match the product's value proposition?",
  ],
  [
    "capabilityCoverageScore",
    "Capability coverage",
    "How much of the documented need is supported by existing product capabilities?",
  ],
  [
    "urgencyScore",
    "Problem urgency",
    "How urgent is the problem based on documented triggers and evidence?",
  ],
  [
    "budgetReadinessScore",
    "Budget readiness",
    "Is there evidence of budget ownership or an established spending path?",
  ],
  [
    "buyingCommitteeFitScore",
    "Buying committee fit",
    "Does the product map to the roles involved in evaluation and approval?",
  ],
] as const;

function averageScore(values: Array<number | null>): string {
  const known = values.filter((value): value is number => value !== null);
  if (known.length === 0) return "Not assessed";
  const average = known.reduce((sum, value) => sum + value, 0) / known.length;
  return `${average.toFixed(1)} / 5 · ${known.length}/5 criteria`;
}

export default async function GrowthProductFitPage() {
  const { orgId } = await requireOrg();
  const [segments, products, assessments] = await Promise.all([
    db
      .select({ id: growthCustomerSegments.id, name: growthCustomerSegments.name })
      .from(growthCustomerSegments)
      .where(eq(growthCustomerSegments.orgId, orgId))
      .orderBy(asc(growthCustomerSegments.name)),
    Promise.resolve(getAllProducts()),
    listGrowthProductSegmentFits(),
  ]);

  const productNames = new Map(products.map((product) => [product.slug, product.name]));

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <Link href="/growth" className="text-sm font-medium text-link hover:underline">
        Growth Engine
      </Link>
      <div className="mt-2">
        <h1 className="text-3xl font-semibold tracking-tight">Product–Segment Fit</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Compare portfolio products against documented customer-segment needs. Scores are internal
          assessments, not market demand, conversion probability or verified revenue.
        </p>
      </div>

      <div className="mt-6 rounded-xl border border-border bg-muted/30 p-4 text-sm">
        <p className="font-medium">Scoring method</p>
        <p className="mt-1 text-muted-foreground">
          Rate each criterion from 0 (no fit) to 5 (strong fit). Leave unknown criteria empty;
          unknown is excluded from the arithmetic mean, never converted to zero. Every displayed
          average shows its evidence coverage as N/5. A validated assessment requires evidence
          notes.
        </p>
      </div>

      <section className="mt-8 rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">New or updated assessment</h2>
        {segments.length > 0 && products.length > 0 ? (
          <form action={saveGrowthProductSegmentFit} className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Customer segment</span>
              <select
                name="segmentId"
                required
                defaultValue=""
                className="rounded-lg border border-border bg-background px-3 py-2"
              >
                <option value="" disabled>
                  Select segment
                </option>
                {segments.map((segment) => (
                  <option key={segment.id} value={segment.id}>
                    {segment.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Product</span>
              <select
                name="productSlug"
                required
                defaultValue=""
                className="rounded-lg border border-border bg-background px-3 py-2"
              >
                <option value="" disabled>
                  Select product
                </option>
                {products.map((product) => (
                  <option key={product.slug} value={product.slug}>
                    {product.name}
                  </option>
                ))}
              </select>
            </label>
            {criteria.map(([name, label, description]) => (
              <label key={name} className="grid gap-1.5 text-sm">
                <span className="font-medium">{label}</span>
                <input
                  name={name}
                  type="number"
                  min={0}
                  max={5}
                  step={1}
                  className="rounded-lg border border-border bg-background px-3 py-2"
                  placeholder="Unknown"
                />
                <span className="text-xs text-muted-foreground">{description}</span>
              </label>
            ))}
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Assessment status</span>
              <select
                name="status"
                defaultValue="hypothesis"
                className="rounded-lg border border-border bg-background px-3 py-2"
              >
                <option value="hypothesis">Hypothesis</option>
                <option value="validated">Validated with evidence</option>
                <option value="not_fit">Not a fit</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-sm md:col-span-2">
              <span className="font-medium">Rationale</span>
              <textarea
                name="rationale"
                required
                maxLength={2000}
                rows={3}
                className="rounded-lg border border-border bg-background px-3 py-2"
                placeholder="Explain the fit or gap between segment needs and product capabilities."
              />
            </label>
            <label className="grid gap-1.5 text-sm md:col-span-2">
              <span className="font-medium">Evidence notes</span>
              <textarea
                name="evidenceNotes"
                maxLength={4000}
                rows={3}
                className="rounded-lg border border-border bg-background px-3 py-2"
                placeholder="Add non-sensitive source references, research dates, sample limitations and unresolved assumptions."
              />
            </label>
            <div className="md:col-span-2">
              <button
                type="submit"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              >
                Save assessment
              </button>
            </div>
          </form>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            Add at least one customer segment and ensure the Product Registry contains products
            before creating assessments.
          </p>
        )}
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Fit matrix</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Organisation-scoped assessments, ordered by customer segment.
            </p>
          </div>
          <span className="text-xs text-muted-foreground">{assessments.length} assessments</span>
        </div>
        {assessments.length > 0 ? (
          <div className="mt-4 overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Segment / product</th>
                  <th className="px-4 py-3 font-medium">Assessment</th>
                  <th className="px-4 py-3 font-medium">Internal fit</th>
                  <th className="px-4 py-3 font-medium">Rationale / evidence</th>
                </tr>
              </thead>
              <tbody>
                {assessments.map((assessment) => (
                  <tr key={assessment.id} className="border-t border-border align-top">
                    <td className="px-4 py-4">
                      <p className="font-medium">{assessment.segmentName}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {productNames.get(assessment.productSlug) ?? assessment.productSlug}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <span className="rounded-full bg-muted px-2.5 py-1 text-xs">
                        {assessment.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 tabular-nums">
                      {averageScore([
                        assessment.needAlignmentScore,
                        assessment.capabilityCoverageScore,
                        assessment.urgencyScore,
                        assessment.budgetReadinessScore,
                        assessment.buyingCommitteeFitScore,
                      ])}
                    </td>
                    <td className="max-w-md px-4 py-4">
                      <p>{assessment.rationale}</p>
                      {assessment.evidenceNotes ? (
                        <p className="mt-2 text-xs text-muted-foreground">
                          {assessment.evidenceNotes}
                        </p>
                      ) : (
                        <p className="mt-2 text-xs text-muted-foreground">
                          No evidence notes supplied.
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No fit assessments yet. Add a segment and create the first product assessment.
          </p>
        )}
      </section>
    </div>
  );
}
