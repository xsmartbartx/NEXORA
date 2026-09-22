import { AppShell } from "@nexora/shell";

const navItems = [{ label: "Analyze", href: "/app" }];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell appName="Sentinel" navItems={navItems}>
      {children}
    </AppShell>
  );
}
