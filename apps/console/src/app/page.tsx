import Link from "next/link";
import { getAllProducts } from "@nexora/registry";
import { requireOrg } from "@nexora/auth/server";
import { getOrgPlan } from "@nexora/billing";
import { listApiKeys } from "./api-keys/actions";

// Data fetching stays out of JSX — see the same note on the Billing and
// Analytics pages (react-hooks/error-boundaries).
async function loadOverviewData(
  orgId: string,
): Promise<{ planName: string; activeKeyCount: number } | null> {
  try {
    const [plan, keys] = await Promise.all([getOrgPlan(orgId), listApiKeys()]);
    return { planName: plan.name, activeKeyCount: keys.filter((k) => !k.revokedAt).length };
  } catch {
    return null;
  }
}

export default async function ConsoleOverview() {
  const { orgId, orgSlug } = await requireOrg();
  const products = getAllProducts();
  const overview = await loadOverviewData(orgId);

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        Overview
      </span>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{orgSlug}</h1>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">Current plan</p>
          <p className="mt-2 text-2xl font-semibold">{overview?.planName ?? "—"}</p>
          <Link href="/billing" className="mt-1 inline-block text-xs text-primary hover:underline">
            Manage billing →
          </Link>
        </div>
        <div className="rounded-xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">API keys</p>
          <p className="mt-2 text-2xl font-semibold">
            {overview ? overview.activeKeyCount : "—"}
          </p>
          <Link href="/api-keys" className="mt-1 inline-block text-xs text-primary hover:underline">
            Manage keys →
          </Link>
        </div>
        <div className="rounded-xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">Platform status</p>
          <p className="mt-2 text-2xl font-semibold text-success">Operational</p>
        </div>
      </div>

      {overview === null ? (
        <p className="mt-4 text-xs text-muted-foreground">
          Database not reachable — plan and key counts need a real DATABASE_URL.
        </p>
      ) : null}

      <div className="mt-12">
        <div className="flex items-end justify-between">
          <h2 className="text-lg font-semibold">Products</h2>
          <Link href="/products" className="text-sm text-primary hover:underline">
            View all →
          </Link>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Every NEXORA product, whether your organisation is entitled to it yet or not — the console
          never hardcodes a product list.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {products.map((product) => (
            <div key={product.id} className="rounded-xl border border-border bg-card p-4">
              <p className="font-medium">{product.short_name}</p>
              <p className="mt-1 text-xs text-muted-foreground">{product.tagline}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
