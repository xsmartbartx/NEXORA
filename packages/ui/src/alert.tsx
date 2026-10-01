import * as React from "react";
import { cn } from "./cn";

/**
 * `rounded-xl border border-dashed border-border p-6 text-sm
 * text-muted-foreground` — the dashed empty/notice-state box duplicated by
 * hand across website, console and status before this existed (same
 * reasoning as `Card`).
 */
export const Alert = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground",
        className,
      )}
      {...props}
    />
  ),
);
Alert.displayName = "Alert";
