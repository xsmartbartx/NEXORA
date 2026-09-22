import type { Metadata } from "next";
import { CreateOrganization } from "@nexora/auth/client";
import { requireAuth } from "@nexora/auth/server";

export const metadata: Metadata = {
  title: "Select an organisation",
};

/**
 * Where `requireOrg()` sends a signed-in user with no active organisation —
 * console is entirely org-scoped (§6.2), unlike account which also serves
 * personal accounts under "Membership optional".
 */
export default async function SelectOrganizationPage() {
  await requireAuth();

  return (
    <div className="mx-auto flex max-w-lg flex-1 flex-col items-center justify-center px-6 py-20 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Create an organisation to continue</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Console is organisation-scoped — products, API keys and billing all belong to an
        organisation, not to you personally.
      </p>
      <div className="mt-8">
        <CreateOrganization afterCreateOrganizationUrl="/" />
      </div>
    </div>
  );
}
