import type { Metadata } from "next";
import Link from "next/link";
import { pillarLabels } from "@nexora/registry";
import { solutions } from "@/lib/nav";

export const metadata: Metadata = {
  title: "Solutions",
  description: "Outcome-oriented ways to use the NEXORA platform.",
};

export default function SolutionsPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-20">
      <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        Solutions
      </span>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">
        Map a problem to a NEXORA product.
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
        Solutions are outcomes, not products. Each one draws on one or more platform pillars.
      </p>

      <div className="mt-12 grid gap-6 sm:grid-cols-2">
        {solutions.map((solution) => (
          <Link
            key={solution.slug}
            href={`/solutions/${solution.slug}`}
            className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/50"
          >
            <h2 className="text-lg font-semibold text-foreground group-hover:text-primary">
              {solution.title}
            </h2>
            <p className="text-sm text-muted-foreground">{solution.description}</p>
            <div className="mt-1 flex gap-2">
              {solution.pillars.map((pillar) => (
                <span
                  key={pillar}
                  className="rounded-full border border-border px-2 py-0.5 font-mono text-xs uppercase tracking-widest text-muted-foreground"
                >
                  {pillarLabels[pillar]}
                </span>
              ))}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
