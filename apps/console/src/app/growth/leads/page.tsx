import type { Metadata } from "next";
import { requireOrg } from "@nexora/auth/server";
import {
  createGrowthLeadFromForm,
  listGrowthCampaigns,
  listGrowthLeads,
  recordGrowthLeadTouchpointFromForm,
  updateGrowthLeadStageFromForm,
} from "../actions";

export const metadata: Metadata = {
  title: "Growth leads",
};

export default async function GrowthLeadsPage() {
  await requireOrg();
  const [leads, campaigns] = await Promise.all([listGrowthLeads(), listGrowthCampaigns()]);

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <p className="text-sm font-medium text-link">Growth Engine</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Acquisition & leads</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        Internal lead register with first-touch UTM context and consent provenance. This is not a
        public intake endpoint and does not send email or synchronise a CRM.
      </p>

      <section className="mt-8 rounded-xl border border-border bg-card p-6">
        <h2 className="font-semibold">Register a lead</h2>
        <form action={createGrowthLeadFromForm} className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Email</span>
            <input
              name="email"
              type="email"
              required
              maxLength={254}
              className="rounded-lg border border-border bg-background px-3 py-2"
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Name (optional)</span>
            <input
              name="name"
              maxLength={160}
              className="rounded-lg border border-border bg-background px-3 py-2"
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Company (optional)</span>
            <input
              name="company"
              maxLength={160}
              className="rounded-lg border border-border bg-background px-3 py-2"
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Campaign</span>
            <select
              name="campaignId"
              defaultValue=""
              className="rounded-lg border border-border bg-background px-3 py-2"
            >
              <option value="">Unassigned</option>
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Source</span>
            <input
              name="source"
              maxLength={100}
              placeholder="linkedin, partner, website"
              className="rounded-lg border border-border bg-background px-3 py-2"
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Medium</span>
            <input
              name="medium"
              maxLength={100}
              placeholder="organic, referral, paid"
              className="rounded-lg border border-border bg-background px-3 py-2"
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">UTM source</span>
            <input
              name="utmSource"
              maxLength={160}
              className="rounded-lg border border-border bg-background px-3 py-2"
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">UTM medium</span>
            <input
              name="utmMedium"
              maxLength={160}
              className="rounded-lg border border-border bg-background px-3 py-2"
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">UTM campaign</span>
            <input
              name="utmCampaign"
              maxLength={160}
              className="rounded-lg border border-border bg-background px-3 py-2"
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">UTM content</span>
            <input
              name="utmContent"
              maxLength={160}
              className="rounded-lg border border-border bg-background px-3 py-2"
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">UTM term</span>
            <input
              name="utmTerm"
              maxLength={160}
              className="rounded-lg border border-border bg-background px-3 py-2"
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Marketing consent status</span>
            <select
              name="consentStatus"
              defaultValue="unknown"
              className="rounded-lg border border-border bg-background px-3 py-2"
            >
              <option value="unknown">Unknown / not recorded</option>
              <option value="granted">Granted</option>
              <option value="denied">Denied</option>
              <option value="not_required">Not required (document basis)</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-sm md:col-span-2">
            <span className="font-medium">Consent evidence / source</span>
            <input
              name="consentSource"
              maxLength={200}
              placeholder="e.g. signed form, CRM record reference"
              className="rounded-lg border border-border bg-background px-3 py-2"
            />
          </label>
          <div className="md:col-span-2">
            <button
              type="submit"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Register lead
            </button>
          </div>
        </form>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          Consent is stored as evidence, not inferred. A granted status requires a recorded source
          and timestamp. Registering a lead does not authorise a marketing send.
        </p>
      </section>

      <section className="mt-10">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Recent leads</h2>
          <span className="text-xs text-muted-foreground">Latest {leads.length} · maximum 100</span>
        </div>
        {leads.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-border p-8 text-center">
            <p className="font-medium">No leads recorded</p>
            <p className="mt-1 text-sm text-muted-foreground">
              New organisation-owned records will appear here.
            </p>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Lead</th>
                  <th className="px-4 py-3 font-medium">Company</th>
                  <th className="px-4 py-3 font-medium">Stage</th>
                  <th className="px-4 py-3 font-medium">Acquisition</th>
                  <th className="px-4 py-3 font-medium">Consent</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3 font-medium">Record touchpoint</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <p className="font-medium">{lead.name || lead.email}</p>
                      {lead.name ? (
                        <p className="text-xs text-muted-foreground">{lead.email}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">{lead.company || "—"}</td>
                    <td className="px-4 py-3">
                      <form
                        action={updateGrowthLeadStageFromForm}
                        className="flex items-center gap-2"
                      >
                        <input type="hidden" name="leadId" value={lead.id} />
                        <select
                          name="stage"
                          defaultValue={lead.stage}
                          aria-label={"Stage for " + lead.email}
                          className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                        >
                          <option value="new">New</option>
                          <option value="qualified">Qualified</option>
                          <option value="contacted">Contacted</option>
                          <option value="disqualified">Disqualified</option>
                        </select>
                        <button
                          type="submit"
                          className="text-xs font-medium text-link hover:underline"
                        >
                          Save
                        </button>
                      </form>
                    </td>
                    <td className="px-4 py-3">
                      <p>{lead.source || lead.utmSource || "Unknown"}</p>
                      <p className="text-xs text-muted-foreground">
                        {lead.medium || lead.utmMedium || "No medium"}
                      </p>
                      {lead.utmCampaign ? (
                        <p className="text-xs text-muted-foreground">{lead.utmCampaign}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 capitalize">{lead.consentStatus.replace("_", " ")}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(
                        new Date(lead.createdAt),
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <form
                        action={recordGrowthLeadTouchpointFromForm}
                        className="grid min-w-56 gap-2"
                      >
                        <input type="hidden" name="leadId" value={lead.id} />
                        <select
                          name="touchpointType"
                          defaultValue="sales_conversation"
                          className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                        >
                          <option value="website_visit">Website visit</option>
                          <option value="content_engagement">Content engagement</option>
                          <option value="demo_request">Demo request</option>
                          <option value="sales_conversation">Sales conversation</option>
                          <option value="event_attendance">Event attendance</option>
                          <option value="partner_referral">Partner referral</option>
                          <option value="other">Other</option>
                        </select>
                        <div className="grid grid-cols-2 gap-1">
                          <input
                            name="source"
                            maxLength={100}
                            placeholder="Source"
                            className="min-w-0 rounded-md border border-border bg-background px-2 py-1 text-xs"
                          />
                          <input
                            name="medium"
                            maxLength={100}
                            placeholder="Medium"
                            className="min-w-0 rounded-md border border-border bg-background px-2 py-1 text-xs"
                          />
                        </div>
                        <input
                          name="utmCampaign"
                          maxLength={160}
                          placeholder="UTM campaign (optional)"
                          className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                        />
                        <button
                          type="submit"
                          className="text-left text-xs font-medium text-link hover:underline"
                        >
                          Add touchpoint
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
