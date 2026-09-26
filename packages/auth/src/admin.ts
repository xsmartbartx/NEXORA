/** The slice of a Clerk user the staff check reads — kept structural so this file has no Clerk import. */
export interface AdminCandidate {
  primaryEmailAddress?: {
    emailAddress: string;
    verification?: { status?: string | null } | null;
  } | null;
}

export function parseAdminAllowlist(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * The staff email for this user, or null if they aren't staff. The
 * primary address must be verified: an allowlisted address that Clerk
 * holds unverified (e.g. handed over by an OAuth provider that doesn't
 * vouch for it) proves nothing about who is signed in, and this check
 * gates every customer's data.
 */
export function adminEmailFor(
  user: AdminCandidate | null | undefined,
  allowlist: string[],
): string | null {
  const primary = user?.primaryEmailAddress;
  if (!primary || primary.verification?.status !== "verified") return null;
  const email = primary.emailAddress.toLowerCase();
  return allowlist.includes(email) ? email : null;
}
