"use client";

import { getAllProducts, lifecycleLabels } from "@nexora/registry";
import { cn } from "@nexora/ui";
import { useState } from "react";
import { platformLinks } from "./platform-links";

const products = getAllProducts();

export function ProductSwitcher() {
  const [open, setOpen] = useState(false);
  const links = platformLinks();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-label="Switch product"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor">
          <rect x="3" y="3" width="7" height="7" rx="1.5" strokeWidth="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" strokeWidth="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" strokeWidth="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" strokeWidth="1.5" />
        </svg>
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 z-50 mt-2 w-72 rounded-lg border border-border bg-popover p-2 shadow-lg">
            <p className="px-2 py-1 font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Platform
            </p>
            {[
              { label: "Website", href: links.website },
              { label: "Console", href: links.console },
              { label: "Account", href: links.account },
              { label: "Status", href: links.status },
            ].map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="block rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-accent"
              >
                {item.label}
              </a>
            ))}

            <p className="mt-2 border-t border-border px-2 pt-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Products
            </p>
            {products.map((product) => {
              const isLive = product.lifecycle !== "concept" && product.lifecycle !== "alpha";
              return (
                <a
                  key={product.id}
                  href={
                    isLive
                      ? (product.app_url ?? product.url)
                      : links.website + `/products/${product.slug}`
                  }
                  className={cn(
                    "flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-accent",
                    isLive ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {product.short_name}
                  <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                    {lifecycleLabels[product.lifecycle]}
                  </span>
                </a>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}
