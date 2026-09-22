import { Badge, type BadgeVariant } from "@nexora/ui";
import { lifecycleLabels, type ProductLifecycle } from "@nexora/registry";

const variantByLifecycle: Record<ProductLifecycle, BadgeVariant> = {
  concept: "neutral",
  alpha: "neutral",
  beta: "brand",
  production: "success",
  maintenance: "warning",
  retired: "neutral",
};

export function LifecycleBadge({ lifecycle }: { lifecycle: ProductLifecycle }) {
  return <Badge variant={variantByLifecycle[lifecycle]}>{lifecycleLabels[lifecycle]}</Badge>;
}
