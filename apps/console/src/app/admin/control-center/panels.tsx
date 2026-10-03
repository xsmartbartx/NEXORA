import type { ReactNode } from "react";
import { cn } from "@nexora/ui";
import type { Tile } from "@nexora/admin";

export type Tone = "good" | "warn" | "bad" | "neutral";

const toneText: Record<Tone, string> = {
  good: "text-success",
  warn: "text-warning",
  bad: "text-destructive",
  neutral: "text-foreground",
};

const toneDot: Record<Tone, string> = {
  good: "bg-success",
  warn: "bg-warning",
  bad: "bg-destructive",
  neutral: "bg-muted-foreground",
};

export function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{title}</h2>
      {description ? (
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
      ) : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function Dot({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span
      role="img"
      aria-label={label}
      className={cn("inline-block size-2.5 rounded-full", toneDot[tone])}
    />
  );
}

/** A labelled figure. `children` is secondary text under the value. */
export function Stat({
  label,
  value,
  tone = "neutral",
  children,
}: {
  label: string;
  value: ReactNode;
  tone?: Tone;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("mt-1 font-mono text-2xl font-semibold tabular-nums", toneText[tone])}>
        {value}
      </div>
      {children ? <div className="mt-1 text-xs text-muted-foreground">{children}</div> : null}
    </div>
  );
}

/** The one place a tile's three states are turned into UI, so every panel degrades the same way. */
export function TileBody<T>({
  tile,
  label,
  children,
}: {
  tile: Tile<T>;
  /** What to call the figure when it can't be shown. */
  label: string;
  children: (data: T) => ReactNode;
}) {
  if (tile.state === "ok") return <>{children(tile.data)}</>;

  if (tile.state === "not-connected") {
    return (
      <div className="rounded-xl border border-dashed border-border p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-1 text-sm font-medium">Not connected</div>
        <p className="mt-1 text-xs text-muted-foreground">{tile.setup}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-destructive/40 p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium text-destructive">Couldn&rsquo;t load</div>
      <p className="mt-1 break-words text-xs text-muted-foreground">{tile.message}</p>
    </div>
  );
}
