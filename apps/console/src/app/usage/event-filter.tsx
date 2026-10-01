"use client";

import { useMemo, useState } from "react";
import { cn } from "@nexora/ui";
import type { AuditEvent } from "@nexora/database";

const categoryLabels: Record<string, string> = {
  sentinel: "Sentinel",
  cspm: "CSPM",
  gateway: "Gateway",
  console: "API Keys",
  admin: "Admin",
};

/** The namespace prefix of `<domain>.<object>.<action>` (Appendix A) is the one real grouping these events already carry — no invented taxonomy. */
function categoryOf(action: string): string {
  return action.split(".")[0] ?? action;
}

export function EventFilter({ events }: { events: AuditEvent[] }) {
  const categories = useMemo(() => {
    const seen = new Set(events.map((event) => categoryOf(event.action)));
    return [...seen].sort();
  }, [events]);

  const [active, setActive] = useState<string | null>(null);
  const filtered = active ? events.filter((event) => categoryOf(event.action) === active) : events;

  if (categories.length === 0) return null;

  return (
    <div>
      {categories.length > 1 ? (
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActive(null)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs",
              active === null
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            All
          </button>
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setActive(category)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs",
                active === category
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {categoryLabels[category] ?? category}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex flex-col divide-y divide-border rounded-xl border border-border">
        {filtered.map((event) => (
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
        {filtered.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No events in this category.</p>
        ) : null}
      </div>
    </div>
  );
}
