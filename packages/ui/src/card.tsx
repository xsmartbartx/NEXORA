import * as React from "react";
import { cn } from "./cn";

export interface CardVariantProps {
  /** Adds the hover/focus affordance every clickable card across the site already repeats by hand. */
  interactive?: boolean;
  className?: string;
}

/**
 * Returns Card's visual classes without rendering a `<div>` — for a
 * non-div clickable card (`next/link`'s `<Link>`, most often), same reason
 * `buttonVariants` exists next to `Button`.
 */
export function cardVariants({ interactive, className }: CardVariantProps = {}) {
  return cn(
    "rounded-xl border border-border bg-card p-6",
    interactive && "transition-colors hover:border-primary/50",
    className,
  );
}

export interface CardProps extends React.HTMLAttributes<HTMLDivElement>, CardVariantProps {}

/**
 * `rounded-xl border border-border bg-card p-6` — the exact class string
 * duplicated by hand in 15+ places across website, status, sentinel, cspm
 * and account before this existed. One component instead of one more
 * copy-paste per app.
 */
export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, interactive, ...props }, ref) => {
    return <div ref={ref} className={cardVariants({ interactive, className })} {...props} />;
  },
);
Card.displayName = "Card";

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col gap-1", className)} {...props} />
  ),
);
CardHeader.displayName = "CardHeader";

export const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3 ref={ref} className={cn("text-base font-semibold text-foreground", className)} {...props} />
));
CardTitle.displayName = "CardTitle";

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
CardDescription.displayName = "CardDescription";

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("mt-4", className)} {...props} />
  ),
);
CardContent.displayName = "CardContent";
