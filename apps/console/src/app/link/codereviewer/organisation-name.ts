import { clerkClient } from "@nexora/auth/server";

/** The organisation's display name, falling back to its id if Clerk cannot be reached. */
export async function organisationName(orgId: string): Promise<string> {
  try {
    const client = await clerkClient();
    const org = await client.organizations.getOrganization({ organizationId: orgId });
    return org.name.slice(0, 200);
  } catch {
    return orgId;
  }
}
