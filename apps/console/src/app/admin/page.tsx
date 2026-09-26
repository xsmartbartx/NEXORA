import type { Metadata } from "next";
import { requireAdmin } from "@nexora/auth/server";
import { listCustomers } from "@nexora/admin";
import { CustomerTable } from "./customer-table";

export const metadata: Metadata = {
  title: "Admin — Customers",
};

export default async function AdminCustomersPage() {
  await requireAdmin();

  let customers;
  let dbError: string | null = null;
  try {
    customers = await listCustomers();
  } catch {
    dbError = "Database or Clerk API not reachable — can't load the customer list right now.";
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <span className="font-mono text-xs uppercase tracking-widest text-warning">NEXORA Staff</span>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Customers</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        Every organisation on the platform, its plan, and this period&rsquo;s usage per product.
        Suspending a product here is independent of billing — it&rsquo;s a second gate ahead of plan
        limits, for when access needs to stop regardless of what the customer is paying for.
      </p>

      <div className="mt-8">
        {dbError ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            {dbError}
          </div>
        ) : customers && customers.length > 0 ? (
          <CustomerTable customers={customers} />
        ) : (
          <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            No customer organisations yet.
          </div>
        )}
      </div>
    </div>
  );
}
