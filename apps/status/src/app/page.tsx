import { Badge, cn } from "@nexora/ui";
import { components, type ComponentStatus } from "./components";

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

const overall: ComponentStatus = components.some((c) => c.status === "down")
  ? "down"
  : components.some((c) => c.status === "degraded")
    ? "degraded"
    : "operational";

export default function StatusPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "h-2.5 w-2.5 rounded-full",
              overall === "operational" && "bg-success",
              overall === "degraded" && "bg-warning",
              overall === "down" && "bg-destructive",
            )}
          />
          <h1 className="text-xl font-semibold">
            {overall === "operational" ? "All systems operational" : "Some systems affected"}
          </h1>
        </div>
      </div>

      <div className="mt-8 flex flex-col divide-y divide-border rounded-xl border border-border">
        {components.map((component) => (
          <div key={component.name} className="flex items-center justify-between gap-4 p-4">
            <div>
              <p className="font-medium">{component.name}</p>
              <p className="text-xs text-muted-foreground">{component.description}</p>
            </div>
            <Badge variant={statusVariant[component.status]}>{statusLabel[component.status]}</Badge>
          </div>
        ))}
      </div>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        Component status is set manually today. Automated health checks land once products exist to
        report through them.
      </p>
    </div>
  );
}
