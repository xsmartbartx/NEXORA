import type { Metadata } from "next";
import { requireOrg } from "@nexora/auth/server";
import { createGrowthCampaignFromForm, listGrowthCampaigns } from "../actions";

export const metadata: Metadata = {
  title: "Growth campaigns",
};

const date = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value))
    : "Not scheduled";

export default async function GrowthCampaignsPage() {
  await requireOrg();
  const campaigns = await listGrowthCampaigns();

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <p className="text-sm font-medium text-link">Growth Engine</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Campaigns</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Create organisation-scoped campaign records. Creating a campaign does not launch ads,
        publish content or send outbound messages.
      </p>

      <section className="mt-8 rounded-xl border border-border bg-card p-6">
        <h2 className="font-semibold">New campaign</h2>
        <form action={createGrowthCampaignFromForm} className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Name</span>
            <input
              name="name"
              required
              maxLength={160}
              className="rounded-lg border border-border bg-background px-3 py-2"
              placeholder="Q1 product launch"
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Objective</span>
            <input
              name="objective"
              required
              maxLength={2000}
              className="rounded-lg border border-border bg-background px-3 py-2"
              placeholder="Increase qualified product sign-ups"
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Start date</span>
            <input
              name="startsAt"
              type="date"
              className="rounded-lg border border-border bg-background px-3 py-2"
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">End date</span>
            <input
              name="endsAt"
              type="date"
              className="rounded-lg border border-border bg-background px-3 py-2"
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Budget (minor currency units)</span>
            <input
              name="budgetCents"
              type="number"
              min="0"
              step="1"
              className="rounded-lg border border-border bg-background px-3 py-2"
              placeholder="Optional"
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Currency</span>
            <input
              name="currency"
              defaultValue="USD"
              minLength={3}
              maxLength={3}
              className="rounded-lg border border-border bg-background px-3 py-2 uppercase"
            />
          </label>
          <div className="md:col-span-2">
            <button
              type="submit"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Create draft campaign
            </button>
          </div>
        </form>
      </section>

      <section className="mt-10">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Campaign portfolio</h2>
          <span className="text-xs text-muted-foreground">{campaigns.length} total</span>
        </div>
        {campaigns.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-border p-8 text-center">
            <p className="font-medium">No campaigns yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create the first campaign using the form above.
            </p>
          </div>
        ) : (
          <div className="mt-4 grid gap-3">
            {campaigns.map((campaign) => (
              <article
                key={campaign.id}
                className="rounded-xl border border-border bg-card p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{campaign.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{campaign.objective}</p>
                  </div>
                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs capitalize">
                    {campaign.status}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
                  <span>
                    {date(campaign.startsAt)} – {date(campaign.endsAt)}
                  </span>
                  <span>
                    {campaign.budgetCents === null
                      ? "No budget set"
                      : `${(campaign.budgetCents / 100).toFixed(2)} ${campaign.currency}`}
                  </span>
                  <span>Updated {date(campaign.updatedAt)}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
