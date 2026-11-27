import type { Metadata } from "next";
import Link from "next/link";
import { requireOrg } from "@nexora/auth/server";
import { getAllProducts } from "@nexora/registry";
import { getGrowthAnalytics } from "./actions";

export const metadata: Metadata = {
  title: "Growth",
};

type GrowthModule = {
  name: string;
  description: string;
  status: string;
  href?: string;
};

const modules: GrowthModule[] = [
  {
    name: "Products",
    description: "Portfolio context, ICP, positioning and approved product claims.",
    status: "Available",
    href: "/growth/products",
  },
  {
    name: "Campaigns",
    description: "Plan objectives, audiences, channels, budgets and launch windows.",
    status: "Available",
    href: "/growth/campaigns",
  },
  {
    name: "Content Studio",
    description: "Create briefs, AI-assisted drafts, revisions and source references.",
    status: "Available",
    href: "/growth/content",
  },
  {
    name: "Approvals",
    description: "Review exact content versions before any external action.",
    status: "Available",
    href: "/growth/approvals",
  },
  {
    name: "Analytics",
    description:
      "Operational campaign, content and approval metrics; business attribution remains pending.",
    status: "Available",
    href: "/growth/analytics",
  },
  {
    name: "Acquisition & Leads",
    description: "Register organisation-owned leads with consent provenance and UTM touchpoints.",
    status: "Available",
    href: "/growth/leads",
  },
  {
    name: "Customer Intelligence",
    description: "Manage customer segments, buyer personas, pain points and buying signals.",
    status: "Available",
    href: "/growth/customer-intelligence",
  },
  {
    name: "Product–Segment Fit",
    description: "Compare product fit with segment needs and documented evidence.",
    status: "Available",
    href: "/growth/product-fit",
  },
  {
    name: "Reports",
    description: "Generate reproducible weekly and monthly growth snapshots.",
    status: "Next",
  },
];

function MetricCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
      <p className="mt-2 text-xs text-muted-foreground">{note}</p>
    </section>
  );
}

export default async function GrowthPage() {
  await requireOrg();
  const products = getAllProducts();
  const analytics = await getGrowthAnalytics();
  const activeCampaigns =
    analytics.campaigns.byStatus.find((row) => row.status === "active")?.count ?? 0;

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-link">NEXORA Console</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Growth Engine</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            One workspace for portfolio marketing, campaign operations, content approvals and
            measurable acquisition. The dashboard only reports metrics from connected sources;
            unavailable data is shown as not configured, never as an invented zero.
          </p>
        </div>
        <span className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground">
          Foundation · P0
        </span>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Portfolio products"
          value={String(products.length)}
          note="Live Product Registry"
        />
        <MetricCard
          label="Active campaigns"
          value={String(activeCampaigns)}
          note={`${analytics.campaigns.total} campaigns in this organisation`}
        />
        <MetricCard
          label="Pending approvals"
          value={String(analytics.approvals.pending)}
          note="Awaiting review"
        />
        <MetricCard
          label="Attributed revenue"
          value="—"
          note="Billing and attribution sources not connected"
        />
      </div>

      <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Growth workspace</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              P0 modules and their current implementation state.
            </p>
          </div>
          <Link href="/products" className="text-sm font-medium text-link hover:underline">
            Open product portfolio →
          </Link>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {modules.map((module) => {
            const content = (
              <>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold">{module.name}</h3>
                  <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                    {module.status}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{module.description}</p>
                {module.href ? (
                  <span className="mt-5 inline-block text-xs font-medium text-link">
                    Open module →
                  </span>
                ) : (
                  <span className="mt-5 inline-block text-xs text-muted-foreground">
                    Planned for the next implementation slice
                  </span>
                )}
              </>
            );

            return module.href ? (
              <Link
                key={module.name}
                href={module.href}
                className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/50"
              >
                {content}
              </Link>
            ) : (
              <section key={module.name} className="rounded-xl border border-border bg-card p-5">
                {content}
              </section>
            );
          })}
        </div>
      </section>

      <section className="mt-10 rounded-xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Automation status</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              n8n is planned as an execution layer. Workflow state will remain persisted in NEXORA.
            </p>
          </div>
          <span className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground">
            Not connected
          </span>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {[
            ["GitHub Release Monitor", "Detect product changes and prepare campaign candidates."],
            ["AI Content Draft", "Generate source-linked drafts through the NEXORA AI Gateway."],
            ["Weekly Growth Report", "Summarise verified campaign and product outcomes."],
          ].map(([name, description]) => (
            <div key={name} className="rounded-lg bg-muted/50 p-4">
              <p className="text-sm font-medium">{name}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
            </div>
          ))}
        </div>
      </section>

      <p className="mt-6 text-xs text-muted-foreground">
        Safety boundary: generated content remains a draft. Publishing, outbound email and pricing
        changes require an explicit approval for the exact proposed version.
      </p>
    </div>
  );
}
