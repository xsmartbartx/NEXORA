import { AppShell } from "@nexora/shell";

const navItems = [
  { label: "Profile", href: "/user-profile" },
  { label: "Organisations", href: "/organizations" },
];

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell appName="Account" navItems={navItems}>
      {children}
    </AppShell>
  );
}
