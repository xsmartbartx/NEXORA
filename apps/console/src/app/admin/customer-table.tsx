"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@nexora/ui";
import type { CustomerSummary } from "@nexora/admin";

function statusVariant(status: string | undefined): "success" | "warning" | "neutral" {
  if (status === "active" || status === "trialing") return "success";
  if (!status) return "neutral";
  return "warning";
}

function ProductMiniBadge({ product }: { product: CustomerSummary["products"][number] }) {
  if (product.suspended) {
    return (
      <Badge variant="warning" title={`${product.product.name}: suspended`}>
        {product.product.name} · suspended
      </Badge>
    );
  }
  const nearLimit = product.limit !== null && product.used >= product.limit * 0.8;
  return (
    <Badge
      variant={nearLimit ? "warning" : "neutral"}
      title={`${product.product.name}: ${product.used}${product.limit === null ? "" : ` / ${product.limit}`}`}
    >
      {product.product.name} · {product.used}
      {product.limit === null ? "" : `/${product.limit}`}
    </Badge>
  );
}

export function CustomerTable({ customers }: { customers: CustomerSummary[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) => c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q),
    );
  }, [customers, query]);

  return (
    <div>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name or slug…"
        className="w-full max-w-sm rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary/50"
      />

      <div className="mt-4 flex flex-col divide-y divide-border rounded-xl border border-border">
        {filtered.map((customer) => {
          const anySuspended = customer.products.some((p) => p.suspended);
          return (
            <Link
              key={customer.orgId}
              href={`/admin/${customer.orgId}`}
              className="flex flex-col gap-3 p-4 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium">{customer.name}</p>
                  {anySuspended ? <Badge variant="warning">suspension active</Badge> : null}
                </div>
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                  {customer.slug} · {customer.membersCount}{" "}
                  {customer.membersCount === 1 ? "member" : "members"} · joined{" "}
                  {customer.createdAt.toLocaleDateString()}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <Badge variant="brand">{customer.plan.name}</Badge>
                <Badge variant={statusVariant(customer.subscription?.status)}>
                  {customer.subscription?.status ?? "free"}
                </Badge>
                {customer.products.map((p) => (
                  <ProductMiniBadge key={p.product.slug} product={p} />
                ))}
              </div>
            </Link>
          );
        })}
        {filtered.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            No customers match &ldquo;{query}&rdquo;.
          </p>
        ) : null}
      </div>
    </div>
  );
}
