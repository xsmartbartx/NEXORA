import * as React from "react";
import { cn } from "./cn";

export type BadgeVariant = "neutral" | "brand" | "warning" | "success";

const variantClasses: Record<BadgeVariant, string> = {
  neutral: "bg-muted text-muted-foreground",
  brand: "bg-primary/15 text-link",
  warning: "bg-warning/15 text-warning",
  success: "bg-success/15 text-success",
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
          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
          variantClasses[variant],
          className,
        )}
        {...props}
      />
    );
  },
);
Badge.displayName = "Badge";
