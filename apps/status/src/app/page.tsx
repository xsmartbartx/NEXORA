import { Badge, Card, cn } from "@nexora/ui";
import {
  categoryLabel,
  components,
  type ComponentCategory,
  type ComponentStatus,
} from "./components";
import { getStatusSnapshot, overallStatus, type ComponentResult } from "./health";

// Probed live on request (with a short shared cache in ./health.ts), never
// at build time — a status baked into the image would be the old
// hand-maintained page again.
export const dynamic = "force-dynamic";

const statusLabel: Record<ComponentStatus, string> = {
  operational: "Operational",
  degraded: "Degraded",
  down: "Down",
};

const statusVariant: Record<ComponentStatus, "success" | "warning" | "neutral"> = {
  operational: "success",
  degraded: "warning",
  down: "neutral",
};

const headline: Record<ComponentStatus, string> = {
  operational: "All systems operational",
  degraded: "Some systems are slow",
  down: "Some systems are down",
};

/** Platform, then Products, then Infrastructure — matches `components.ts`'s declared order within each group. */
const categoryOrder: ComponentCategory[] = ["platform", "products", "infrastructure"];

function groupByCategory(results: ComponentResult[]): [ComponentCategory, ComponentResult[]][] {
  return categoryOrder
    .map((category): [ComponentCategory, ComponentResult[]] => [
      category,
      results.filter((r) => r.category === category),
    ])
    .filter(([, items]) => items.length > 0);
}

export default async function StatusPage() {
  const snapshot = await getStatusSnapshot(components);
  const overall = overallStatus(snapshot.components);

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <Card>
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "h-2.5 w-2.5 rounded-full",
              overall === "operational" && "bg-success",
              overall === "degraded" && "bg-warning",
              overall === "down" && "bg-destructive",
            )}
          />
          <h1 className="text-xl font-semibold">{headline[overall]}</h1>
        </div>
      </Card>

      {groupByCategory(snapshot.components).map(([category, items]) => (
        <div key={category} className="mt-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {categoryLabel[category]}
          </h2>
          <div className="flex flex-col divide-y divide-border rounded-xl border border-border">
            {items.map((component) => (
              <div key={component.name} className="flex items-center justify-between gap-4 p-4">
                <div>
                  <p className="font-medium">{component.name}</p>
                  <p className="text-xs text-muted-foreground">{component.description}</p>
                </div>
                <div className="flex items-center gap-3">
                  {component.latencyMs !== null && (
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {component.latencyMs} ms
                    </span>
                  )}
                  <Badge variant={statusVariant[component.status]}>
                    {statusLabel[component.status]}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <p className="mt-8 text-center text-xs text-muted-foreground">
        Checked live at{" "}
        <time dateTime={snapshot.checkedAt.toISOString()}>
          {snapshot.checkedAt.toISOString().replace("T", " ").slice(0, 19)} UTC
        </time>
        . Each component&apos;s public URL is requested directly; results refresh every 30 seconds.
      </p>
    </div>
  );
}
