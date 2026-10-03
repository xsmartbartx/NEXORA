import Link from "next/link";
import { cn } from "@nexora/ui";

const tabs = [
  { label: "Control Center", href: "/admin/control-center" },
  { label: "Customers", href: "/admin" },
];

export function AdminNav({ current }: { current: string }) {
  return (
    <nav className="mt-4 flex gap-1 border-b border-border" aria-label="Admin sections">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={tab.href === current ? "page" : undefined}
          className={cn(
            "-mb-px border-b-2 px-3 py-2 text-sm transition-colors",
            tab.href === current
              ? "border-primary font-medium text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
