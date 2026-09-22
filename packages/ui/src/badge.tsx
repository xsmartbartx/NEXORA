import * as React from "react";
import { cn } from "./cn";

export type BadgeVariant = "neutral" | "brand" | "warning" | "success";

const variantClasses: Record<BadgeVariant, string> = {
  neutral: "border-border text-muted-foreground",
  brand: "border-primary/40 text-primary",
  warning: "border-warning/40 text-warning",
  success: "border-success/40 text-success",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = "neutral", ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-xs uppercase tracking-wide",
          variantClasses[variant],
          className,
        )}
        {...props}
      />
    );
  },
);
Badge.displayName = "Badge";
