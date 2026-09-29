"use client";

import { getAllProducts, lifecycleLabels } from "@nexora/registry";
import { cn } from "@nexora/ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { platformLinks } from "./platform-links";
import type { ShellNavItem } from "./app-shell";

export const COMMAND_PALETTE_OPEN_EVENT = "nexora:open-command-palette";

interface PaletteItem {
  label: string;
  group: string;
  href: string;
  hint?: string;
}

/**
 * ⌘K / Ctrl+K, global to every app that renders `AppShell`. One flat,
 * filterable list of everywhere a signed-in user can go from here — this
 * app's own nav, the rest of the platform, and every registry product —
 * rather than a separate widget per destination type.
 */
export function CommandPalette({ navItems }: { navItems: ShellNavItem[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    // Lets the header's visible ⌘K button open the same palette without
    // lifting this component's state up through every AppShell consumer.
    function onOpenRequest() {
      setOpen(true);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener(COMMAND_PALETTE_OPEN_EVENT, onOpenRequest);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(COMMAND_PALETTE_OPEN_EVENT, onOpenRequest);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setHighlight(0);
      queueMicrotask(() => inputRef.current?.focus());
    }
  }, [open]);

  const items = useMemo((): PaletteItem[] => {
    const links = platformLinks();
    const nav = navItems.map((item) => ({ label: item.label, group: "This app", href: item.href }));
    const platform = [
      { label: "Website", href: links.website },
      { label: "Console", href: links.console },
      { label: "Account", href: links.account },
      { label: "Status", href: links.status },
      { label: "Developers", href: links.developers },
      { label: "Docs", href: links.docs },
    ].map((item) => ({ ...item, group: "Platform" }));
    const products = getAllProducts().map((product) => {
      const isLive = product.lifecycle !== "concept" && product.lifecycle !== "alpha";
      return {
        label: product.short_name,
        group: "Products",
        href: isLive ? (product.app_url ?? product.url) : `${links.website}/products/${product.slug}`,
        hint: lifecycleLabels[product.lifecycle],
      };
    });
    return [...nav, ...platform, ...products];
  }, [navItems]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) => item.label.toLowerCase().includes(q) || item.group.toLowerCase().includes(q),
    );
  }, [items, query]);

  function go(item: PaletteItem | undefined) {
    if (!item) return;
    setOpen(false);
    window.location.href = item.href;
  }

  function onInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(filtered[highlight]);
    }
  }

  if (!open) return null;

  let flatIndex = -1;
  const grouped = new Map<string, { item: PaletteItem; index: number }[]>();
  for (const item of filtered) {
    flatIndex += 1;
    const bucket = grouped.get(item.group) ?? [];
    bucket.push({ item, index: flatIndex });
    grouped.set(item.group, bucket);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[15vh]">
      <button
        type="button"
        aria-label="Close command palette"
        className="fixed inset-0 cursor-default"
        onClick={() => setOpen(false)}
      />
      <div className="relative w-full max-w-lg rounded-lg border border-border bg-popover shadow-xl">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlight(0);
          }}
          onKeyDown={onInputKeyDown}
          placeholder="Search NEXORA..."
          aria-label="Search NEXORA"
          className="w-full border-b border-border bg-transparent px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
        <div className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="px-2 py-4 text-center text-sm text-muted-foreground">No matches.</p>
          ) : (
            [...grouped.entries()].map(([group, groupItems]) => (
              <div key={group}>
                <p className="px-2 pt-2 pb-1 font-mono text-xs uppercase tracking-widest text-muted-foreground">
                  {group}
                </p>
                {groupItems.map(({ item, index }) => (
                  <button
                    key={`${item.group}-${item.label}`}
                    type="button"
                    onMouseEnter={() => setHighlight(index)}
                    onClick={() => go(item)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm",
                      index === highlight ? "bg-accent text-accent-foreground" : "text-foreground",
                    )}
                  >
                    {item.label}
                    {item.hint ? (
                      <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                        {item.hint}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
