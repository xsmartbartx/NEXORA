import type { Metadata } from "next";
import Link from "next/link";
import { requireOrg } from "@nexora/auth/server";
import { getAllProducts } from "@nexora/registry";
import {
  listGrowthCustomerIntelligence,
  saveGrowthCustomerPersona,
  saveGrowthCustomerSegment,
} from "./actions";

export const metadata: Metadata = {
  title: "Customer Intelligence",
};

function lines(values: string[]): string {
  return values.join("\n");
}

function ListField({
  name,
  label,
  value,
  placeholder,
}: {
  name: string;
  label: string;
  value?: string[];
  placeholder: string;
}) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      <textarea
        name={name}
        rows={3}
        defaultValue={lines(value ?? [])}
        placeholder={placeholder}
        className="rounded-lg border border-border bg-background px-3 py-2"
      />
      <span className="text-xs text-muted-foreground">One item per line; maximum 30 items.</span>
    </label>
  );
}

export default async function GrowthCustomerIntelligencePage() {
  await requireOrg();
  const [data, products] = await Promise.all([
    listGrowthCustomerIntelligence(),
    Promise.resolve(getAllProducts()),
  ]);

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <Link href="/growth" className="text-sm font-medium text-link hover:underline">
        Growth Engine
      </Link>
      <div className="mt-2">
        <h1 className="text-3xl font-semibold tracking-tight">Customer Intelligence</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Build reusable market segments and buyer personas. Keep assumptions distinct from evidence
          and use confidence as a qualitative assessment, not a purchase probability.
        </p>
      </div>

      <div className="mt-6 rounded-xl border border-border bg-muted/30 p-4 text-sm">
        <p className="font-medium">Data handling boundary</p>
        <p className="mt-1 text-muted-foreground">
          Store aggregate market insights and fictionalised role-based personas only. Do not enter
          identifiable personal data, private contact details, sensitive attributes or inferred
          traits about individual people. Buying signals are hypotheses until supported by evidence.
        </p>
      </div>

      <section className="mt-8 rounded-xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Customer segments</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Define the market group, firmographics and buying triggers.
            </p>
          </div>
          <span className="text-xs text-muted-foreground">{data.segments.length} segments</span>
        </div>
        <form action={saveGrowthCustomerSegment} className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Segment name</span>
            <input
              name="name"
              required
              maxLength={120}
              className="rounded-lg border border-border bg-background px-3 py-2"
              placeholder="Mid-market SaaS companies"
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Industry</span>
            <input
              name="industry"
              maxLength={120}
              className="rounded-lg border border-border bg-background px-3 py-2"
              placeholder="Software / Technology"
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Company size</span>
            <input
              name="companySize"
              maxLength={120}
              className="rounded-lg border border-border bg-background px-3 py-2"
              placeholder="100–1,000 employees"
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Market / geography</span>
            <input
              name="market"
              maxLength={120}
              className="rounded-lg border border-border bg-background px-3 py-2"
              placeholder="DACH, EU, North America"
            />
          </label>
          <label className="grid gap-1.5 text-sm md:col-span-2">
            <span className="font-medium">Description</span>
            <textarea
              name="description"
              rows={2}
              maxLength={2000}
              className="rounded-lg border border-border bg-background px-3 py-2"
              placeholder="Describe shared needs and buying context."
            />
          </label>
          <div className="md:col-span-2">
            <ListField
              name="buyingTriggers"
              label="Buying triggers"
              placeholder={
                "New compliance requirement\nCloud migration\nSecurity incident response"
              }
            />
          </div>
          <div className="md:col-span-2">
            <button
              type="submit"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Save segment
            </button>
          </div>
        </form>

        {data.segments.length > 0 ? (
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {data.segments.map((segment) => (
              <article key={segment.id} className="rounded-lg border border-border p-4">
                <h3 className="font-semibold">{segment.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {[segment.industry, segment.companySize, segment.market]
                    .filter(Boolean)
                    .join(" · ") || "Firmographics not specified"}
                </p>
                {segment.description ? (
                  <p className="mt-3 text-sm text-muted-foreground">{segment.description}</p>
                ) : null}
                {segment.buyingTriggers.length > 0 ? (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Triggers: {segment.buyingTriggers.join(" · ")}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-5 rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">
            No segments yet. Create a segment before adding personas.
          </p>
        )}
      </section>

      <section className="mt-8 rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">Buyer persona</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Personas are role-based working models. A validated status should be supported by
          documented research or customer evidence.
        </p>
        {data.segments.length > 0 ? (
          <form action={saveGrowthCustomerPersona} className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Persona name</span>
              <input
                name="name"
                required
                maxLength={120}
                className="rounded-lg border border-border bg-background px-3 py-2"
                placeholder="Security-conscious IT Director"
              />
            </label>
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
                {data.segments.map((segment) => (
                  <option key={segment.id} value={segment.id}>
                    {segment.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Role / job title</span>
              <input
                name="role"
                maxLength={160}
                className="rounded-lg border border-border bg-background px-3 py-2"
                placeholder="IT Director"
              />
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Seniority</span>
              <select
                name="seniority"
                defaultValue=""
                className="rounded-lg border border-border bg-background px-3 py-2"
              >
                <option value="">Not specified</option>
                <option value="individual_contributor">Individual contributor</option>
                <option value="manager">Manager</option>
                <option value="director">Director</option>
                <option value="vp">VP</option>
                <option value="c_level">C-level</option>
                <option value="owner">Owner / Founder</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Related product (optional)</span>
              <select
                name="productSlug"
                defaultValue=""
                className="rounded-lg border border-border bg-background px-3 py-2"
              >
                <option value="">Portfolio-wide</option>
                {products.map((product) => (
                  <option key={product.slug} value={product.slug}>
                    {product.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Evidence confidence</span>
              <select
                name="confidence"
                defaultValue="low"
                className="rounded-lg border border-border bg-background px-3 py-2"
              >
                <option value="low">Low — hypothesis</option>
                <option value="medium">Medium — some supporting evidence</option>
                <option value="high">High — repeatedly validated</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Lifecycle status</span>
              <select
                name="status"
                defaultValue="draft"
                className="rounded-lg border border-border bg-background px-3 py-2"
              >
                <option value="draft">Draft</option>
                <option value="validated">Validated</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            <ListField
              name="goals"
              label="Goals"
              placeholder={"Reduce operational risk\nImprove team visibility"}
            />
            <ListField
              name="painPoints"
              label="Pain points"
              placeholder={"Fragmented tooling\nLimited reporting"}
            />
            <ListField
              name="jobsToBeDone"
              label="Jobs to be done"
              placeholder={"Assess security posture\nPrepare audit evidence"}
            />
            <ListField
              name="objections"
              label="Objections"
              placeholder={"Implementation effort\nBudget approval"}
            />
            <ListField
              name="successCriteria"
              label="Success criteria"
              placeholder={"Faster reporting\nClear ownership"}
            />
            <ListField
              name="buyingSignals"
              label="Buying signals"
              placeholder={"Published RFP\nPublicly announced migration"}
            />
            <label className="grid gap-1.5 text-sm md:col-span-2">
              <span className="font-medium">Evidence notes</span>
              <textarea
                name="evidenceNotes"
                rows={3}
                maxLength={4000}
                className="rounded-lg border border-border bg-background px-3 py-2"
                placeholder="Record non-sensitive source references, research date, sample limitations and unresolved assumptions."
              />
            </label>
            <div className="md:col-span-2">
              <button
                type="submit"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              >
                Save persona
              </button>
            </div>
          </form>
        ) : (
          <p className="mt-5 text-sm text-muted-foreground">Create a customer segment first.</p>
        )}
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Persona library</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Latest organisation-owned persona records.
            </p>
          </div>
          <span className="text-xs text-muted-foreground">{data.personas.length} personas</span>
        </div>
        {data.personas.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No personas created yet.
          </div>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {data.personas.map((persona) => (
              <article key={persona.id} className="rounded-xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-link">{persona.segmentName}</p>
                    <h3 className="mt-1 font-semibold">{persona.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {[persona.role, persona.seniority, persona.productSlug]
                        .filter(Boolean)
                        .join(" · ") || "Role not specified"}
                    </p>
                  </div>
                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs capitalize text-muted-foreground">
                    {persona.status} · {persona.confidence} confidence
                  </span>
                </div>
                <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <p className="font-medium">Goals</p>
                    <p className="mt-1 text-muted-foreground">
                      {persona.goals.join(" · ") || "Not specified"}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium">Pain points</p>
                    <p className="mt-1 text-muted-foreground">
                      {persona.painPoints.join(" · ") || "Not specified"}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium">Jobs to be done</p>
                    <p className="mt-1 text-muted-foreground">
                      {persona.jobsToBeDone.join(" · ") || "Not specified"}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium">Buying signals</p>
                    <p className="mt-1 text-muted-foreground">
                      {persona.buyingSignals.join(" · ") || "Not specified"}
                    </p>
                  </div>
                </div>
                {persona.evidenceNotes ? (
                  <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
                    Evidence: {persona.evidenceNotes}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
