import type { Metadata } from "next";
import { requireOrg } from "@nexora/auth/server";
import { getAllProducts } from "@nexora/registry";
import {
  createGrowthContentDraftFromForm,
  generateGrowthContentDraftFromForm,
  listGrowthCampaigns,
  listGrowthContentItems,
  requestGrowthApprovalFromForm,
} from "../actions";

export const metadata: Metadata = {
  title: "Growth Content Studio",
};

export default async function GrowthContentPage() {
  await requireOrg();
  const [campaigns, items] = await Promise.all([
    listGrowthCampaigns(),
    listGrowthContentItems(),
  ]);
  const products = getAllProducts();

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <p className="text-sm font-medium text-link">Growth Engine</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Content Studio</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Create versioned content drafts tied to a campaign or product. This workspace stores
        drafts only; it does not publish or distribute content.
      </p>

      <section className="mt-8 rounded-xl border border-border bg-card p-6">
        <div>
          <h2 className="font-semibold">AI draft generator</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Generate a first draft through the NEXORA AI Gateway. Output is saved as version 1
            and must pass the normal approval workflow before any external use.
          </p>
        </div>
        <form action={generateGrowthContentDraftFromForm} className="mt-4 grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Draft title</span>
              <input
                name="title"
                required
                maxLength={200}
                className="rounded-lg border border-border bg-background px-3 py-2"
              />
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Content type</span>
              <select
                name="contentType"
                required
                defaultValue="social_post"
                className="rounded-lg border border-border bg-background px-3 py-2"
              >
                <option value="social_post">Social post</option>
                <option value="article">Article</option>
                <option value="email">Email</option>
                <option value="video_script">Video script</option>
                <option value="landing_page">Landing page</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Target channel</span>
              <select
                name="channel"
                required
                defaultValue="linkedin"
                className="rounded-lg border border-border bg-background px-3 py-2"
              >
                <option value="linkedin">LinkedIn</option>
                <option value="youtube">YouTube</option>
                <option value="website">Website / SEO</option>
                <option value="email">Email</option>
                <option value="x">X</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Campaign (optional)</span>
              <select
                name="campaignId"
                defaultValue=""
                className="rounded-lg border border-border bg-background px-3 py-2"
              >
                <option value="">No campaign</option>
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm md:col-span-2">
              <span className="font-medium">Product (optional)</span>
              <select
                name="productSlug"
                defaultValue=""
                className="rounded-lg border border-border bg-background px-3 py-2"
              >
                <option value="">No product association</option>
                {products.map((product) => (
                  <option key={product.id} value={product.slug}>
                    {product.short_name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Creative brief</span>
            <textarea
              name="brief"
              required
              maxLength={8000}
              rows={6}
              className="rounded-lg border border-border bg-background px-3 py-2"
              placeholder="Describe the audience, objective, key message, evidence and desired call to action."
            />
          </label>
          <div>
            <button
              type="submit"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Generate draft
            </button>
          </div>
        </form>
      </section>

      <section className="mt-8 rounded-xl border border-border bg-card p-6">
        <h2 className="font-semibold">Create content manually</h2>
        <form action={createGrowthContentDraftFromForm} className="mt-4 grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Title</span>
              <input
                name="title"
                required
                maxLength={200}
                className="rounded-lg border border-border bg-background px-3 py-2"
              />
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Content type</span>
              <select
                name="contentType"
                required
                defaultValue="social_post"
                className="rounded-lg border border-border bg-background px-3 py-2"
              >
                <option value="social_post">Social post</option>
                <option value="article">Article</option>
                <option value="email">Email</option>
                <option value="video_script">Video script</option>
                <option value="landing_page">Landing page</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Channel</span>
              <select
                name="channel"
                required
                defaultValue="linkedin"
                className="rounded-lg border border-border bg-background px-3 py-2"
              >
                <option value="linkedin">LinkedIn</option>
                <option value="youtube">YouTube</option>
                <option value="website">Website / SEO</option>
                <option value="email">Email</option>
                <option value="x">X</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Campaign (optional)</span>
              <select
                name="campaignId"
                defaultValue=""
                className="rounded-lg border border-border bg-background px-3 py-2"
              >
                <option value="">No campaign</option>
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm md:col-span-2">
              <span className="font-medium">NEXORA product (optional)</span>
              <select
                name="productSlug"
                defaultValue=""
                className="rounded-lg border border-border bg-background px-3 py-2"
              >
                <option value="">No product association</option>
                {products.map((product) => (
                  <option key={product.id} value={product.slug}>
                    {product.short_name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Draft body</span>
            <textarea
              name="body"
              required
              maxLength={50000}
              rows={10}
              className="rounded-lg border border-border bg-background px-3 py-2"
              placeholder="Write or paste the first draft. AI generation will be connected through the AI Gateway in a later slice."
            />
          </label>
          <div>
            <button
              type="submit"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Save version 1 draft
            </button>
          </div>
        </form>
      </section>

      <section className="mt-10">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Content library</h2>
          <span className="text-xs text-muted-foreground">{items.length} items</span>
        </div>
        {items.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-border p-8 text-center">
            <p className="font-medium">No content drafts yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              New drafts will appear here with their version and approval state.
            </p>
          </div>
        ) : (
          <div className="mt-4 grid gap-3">
            {items.map((item) => (
              <article key={item.id} className="rounded-xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{item.title}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.contentType.replaceAll("_", " ")} · {item.channel} · Version{" "}
                      {item.version ?? "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-muted px-2.5 py-1 text-xs capitalize">
                      {item.status.replaceAll("_", " ")}
                    </span>
                    {item.versionId && item.status !== "in_review" && item.status !== "approved" ? (
                      <form action={requestGrowthApprovalFromForm}>
                        <input type="hidden" name="contentVersionId" value={item.versionId} />
                        <button
                          type="submit"
                          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium"
                        >
                          Request approval
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
