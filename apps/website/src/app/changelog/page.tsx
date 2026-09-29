import type { Metadata } from "next";
import { Badge, type BadgeVariant } from "@nexora/ui";
import { changelogKindLabels, getChangelog, getProductBySlug } from "@nexora/registry";
import type { ChangelogEntryKind } from "@nexora/registry";

export const metadata: Metadata = {
  title: "Changelog",
  description: "What actually shipped on NEXORA, dated and factual.",
};

const kindVariant: Record<ChangelogEntryKind, BadgeVariant> = {
  added: "success",
  changed: "brand",
  fixed: "warning",
  removed: "neutral",
};

export default function ChangelogPage() {
  const entries = getChangelog();

  return (
    <div className="mx-auto max-w-3xl px-6 py-20">
      <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        NEXORA
      </span>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">Changelog</h1>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        What actually shipped, dated. Not a roadmap and not marketing copy — every entry here is
        something already live on the platform.
      </p>

      <div className="mt-10 flex flex-col gap-8">
        {entries.map((entry) => {
          const product = entry.product ? getProductBySlug(entry.product) : undefined;
          return (
            <div key={entry.id} className="border-l-2 border-border pl-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <time dateTime={entry.date}>{entry.date}</time>
                {product ? <span>· {product.short_name}</span> : null}
              </div>
              <div className="mt-1 flex items-center gap-2">
                <Badge variant={kindVariant[entry.kind]}>{changelogKindLabels[entry.kind]}</Badge>
                <h2 className="text-base font-semibold text-foreground">{entry.title}</h2>
              </div>
              {entry.description ? (
                <p className="mt-2 text-sm leading-relaxed text-foreground/90">
                  {entry.description}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
