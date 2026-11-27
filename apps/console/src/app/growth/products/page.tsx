import type { Metadata } from "next";
import Link from "next/link";
import { requireOrg } from "@nexora/auth/server";
import { getAllProducts } from "@nexora/registry";
import { listGrowthProductProfiles, saveGrowthProductProfile } from "./actions";

export const metadata: Metadata = {
  title: "Product Growth Profiles",
};

function lines(values: string[] | null | undefined): string {
  return (values ?? []).join("\n");
}

export default async function GrowthProductsPage() {
  await requireOrg();
  const [products, profiles] = await Promise.all([
    Promise.resolve(getAllProducts()),
    listGrowthProductProfiles(),
  ]);
  const profileBySlug = new Map(
    profiles.map((profile) => [profile.productSlug, profile]),
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <Link href="/growth" className="text-sm font-medium text-link hover:underline">
        Growth Engine
      </Link>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Product Growth Profiles
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Organisation-owned marketing context layered over the canonical Product
            Registry. Registry identity and product facts are not copied or modified
            here.
          </p>
        </div>
        <span className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground">
          {profiles.length} / {products.length} profiles configured
        </span>
      </div>

      <div className="mt-8 grid gap-5">
        {products.map((product) => {
          const profile = profileBySlug.get(product.slug);
          return (
            <section
              key={product.slug}
              className="rounded-xl border border-border bg-card p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-link">{product.slug}</p>
                  <h2 className="mt-1 text-xl font-semibold">{product.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {product.tagline}
                  </p>
                </div>
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs capitalize text-muted-foreground">
                  {profile ? "Configured" : "Not configured"}
                </span>
              </div>

              <form
                action={saveGrowthProductProfile}
                className="mt-6 grid gap-4 md:grid-cols-2"
              >
                <input type="hidden" name="productSlug" value={product.slug} />
                <label className="grid gap-1.5 text-sm md:col-span-2">
                  <span className="font-medium">Ideal customer profile</span>
                  <textarea
                    name="idealCustomerProfile"
                    rows={3}
                    maxLength={4000}
                    defaultValue={profile?.idealCustomerProfile ?? ""}
                    className="rounded-lg border border-border bg-background px-3 py-2"
                    placeholder="Describe the organisation, maturity, needs and buying context."
                  />
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Positioning</span>
                  <textarea
                    name="positioning"
                    rows={3}
                    maxLength={2000}
                    defaultValue={profile?.positioning ?? ""}
                    className="rounded-lg border border-border bg-background px-3 py-2"
                    placeholder="How should this product be positioned in its market?"
                  />
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Value proposition</span>
                  <textarea
                    name="valueProposition"
                    rows={3}
                    maxLength={2000}
                    defaultValue={profile?.valueProposition ?? ""}
                    className="rounded-lg border border-border bg-background px-3 py-2"
                    placeholder="What customer outcome does it support?"
                  />
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Differentiators</span>
                  <textarea
                    name="differentiators"
                    rows={3}
                    maxLength={2000}
                    defaultValue={profile?.differentiators ?? ""}
                    className="rounded-lg border border-border bg-background px-3 py-2"
                    placeholder="Evidence-backed distinctions; avoid unsupported superlatives."
                  />
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Target roles (one per line)</span>
                  <textarea
                    name="targetRoles"
                    rows={3}
                    defaultValue={lines(profile?.targetRoles)}
                    className="rounded-lg border border-border bg-background px-3 py-2"
                    placeholder={"CISO\nHead of IT\nPlatform Engineer"}
                  />
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Use cases (one per line)</span>
                  <textarea
                    name="useCases"
                    rows={3}
                    defaultValue={lines(profile?.useCases)}
                    className="rounded-lg border border-border bg-background px-3 py-2"
                    placeholder={"Centralise security visibility\nAutomate routine analysis"}
                  />
                </label>
                <label className="grid gap-1.5 text-sm md:col-span-2">
                  <span className="font-medium">Approved claims (one per line)</span>
                  <textarea
                    name="approvedClaims"
                    rows={3}
                    defaultValue={lines(profile?.approvedClaims)}
                    className="rounded-lg border border-border bg-background px-3 py-2"
                    placeholder="Only claims verified and authorised for marketing use."
                  />
                  <span className="text-xs text-muted-foreground">
                    These are organisation-approved statements, not independently
                    verified facts. Add supporting evidence before using them in
                    published material.
                  </span>
                </label>
                <div className="flex flex-wrap items-center justify-between gap-3 md:col-span-2">
                  <span className="text-xs text-muted-foreground">
                    {profile
                      ? `Updated ${new Date(profile.updatedAt).toLocaleDateString()}`
                      : "No profile saved"}
                  </span>
                  <button
                    type="submit"
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                  >
                    Save profile
                  </button>
                </div>
              </form>
            </section>
          );
        })}
      </div>
    </div>
  );
}
