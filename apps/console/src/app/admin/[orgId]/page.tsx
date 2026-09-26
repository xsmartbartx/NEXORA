import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@nexora/auth/server";
import { getCustomer } from "@nexora/admin";
import { Badge } from "@nexora/ui";
import { ProductControl } from "./product-control";

export const metadata: Metadata = {
  title: "Admin — Customer",
};

function statusVariant(status: string | undefined): "success" | "warning" | "neutral" {
  if (status === "active" || status === "trialing") return "success";
  if (!status) return "neutral";
  return "warning";
}

export default async function AdminCustomerPage({ params }: PageProps<"/admin/[orgId]">) {
  await requireAdmin();
  const { orgId } = await params;

  const customer = await getCustomer(orgId);
  if (!customer) notFound();

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <Link href="/admin" className="text-sm text-primary hover:underline">
        ← All customers
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="font-mono text-xs uppercase tracking-widest text-warning">
            NEXORA Staff
          </span>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{customer.name}</h1>
          <p className="mt-1 font-mono text-sm text-muted-foreground">
            {customer.orgId} · {customer.slug}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="brand">{customer.plan.name}</Badge>
          <Badge variant={statusVariant(customer.subscription?.status)}>
            {customer.subscription?.status ?? "free"}
          </Badge>
        </div>
      </div>

      {customer.subscription?.stripeCustomerId ? (
        <a
          href={`https://dashboard.stripe.com/customers/${customer.subscription.stripeCustomerId}`}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-block text-sm text-primary hover:underline"
        >
          View in Stripe →
        </a>
      ) : null}

      <div className="mt-10">
        <h2 className="text-lg font-semibold">Product access</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Independent of plan — suspending here blocks the product even if the customer&rsquo;s
          plan would otherwise allow it.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {customer.products.map((usage) => (
            <ProductControl
              key={usage.product.slug}
              orgId={customer.orgId}
              usage={usage}
              suspension={customer.suspensions.get(usage.product.slug)}
            />
          ))}
        </div>
      </div>

      <div className="mt-10">
        <h2 className="text-lg font-semibold">Members ({customer.members.length})</h2>
        <div className="mt-4 flex flex-col divide-y divide-border rounded-xl border border-border">
          {customer.members.map((member) => (
            <div key={member.userId} className="flex items-center justify-between gap-4 p-4">
              <div>
                <p className="text-sm font-medium">{member.name}</p>
                {member.email ? (
                  <p className="text-xs text-muted-foreground">{member.email}</p>
                ) : null}
              </div>
              <Badge variant="neutral">{member.role.replace("org:", "")}</Badge>
            </div>
          ))}
          {customer.members.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No members.</p>
          ) : null}
        </div>
      </div>

      <div className="mt-10">
        <h2 className="text-lg font-semibold">Recent activity</h2>
        <div className="mt-4 flex flex-col divide-y divide-border rounded-xl border border-border">
          {customer.recentEvents.map((event) => (
            <div key={event.id} className="flex items-center justify-between gap-4 p-4">
              <div>
                <p className="font-mono text-sm">{event.action}</p>
                {event.resourceType ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {event.resourceType}
                    {event.resourceId ? ` · ${event.resourceId}` : ""}
                  </p>
                ) : null}
              </div>
              <time
                className="shrink-0 text-xs text-muted-foreground"
                dateTime={event.createdAt.toISOString()}
              >
                {event.createdAt.toLocaleString()}
              </time>
            </div>
          ))}
          {customer.recentEvents.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No activity yet.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
