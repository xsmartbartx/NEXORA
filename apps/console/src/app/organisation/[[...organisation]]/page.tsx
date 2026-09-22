import { OrganizationProfile } from "@nexora/auth/client";
import { requireOrg } from "@nexora/auth/server";

export default async function OrganisationPage() {
  await requireOrg();
  return (
    <div className="flex flex-1 justify-center px-6 py-12">
      <OrganizationProfile />
    </div>
  );
}
