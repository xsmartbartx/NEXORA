import { AppShell } from "@nexora/shell";

const navItems = [{ label: "Scan", href: "/app" }];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell appName="CSPM" navItems={navItems}>
      {children}
    </AppShell>
  );
}
