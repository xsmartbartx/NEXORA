import type { Metadata } from "next";
import { OrganizationList } from "@nexora/auth/client";
import { requireAuth } from "@nexora/auth/server";

export const metadata: Metadata = {
  title: "Organisations",
};

export default async function OrganizationsPage() {
  await requireAuth();
  return (
    <div className="flex flex-1 justify-center px-6 py-12">
      <OrganizationList hidePersonal={false} afterSelectOrganizationUrl="/" afterCreateOrganizationUrl="/" />
    </div>
  );
}
