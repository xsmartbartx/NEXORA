import { AppShell } from "@nexora/shell";

const navItems = [{ label: "Playground", href: "/app" }];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell appName="Gateway" navItems={navItems}>
      {children}
    </AppShell>
  );
}
