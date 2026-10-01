import type { Metadata } from "next";
import Link from "next/link";
import { and, eq, isNull } from "drizzle-orm";
import { clerkClient, currentUser, requireOrg } from "@nexora/auth/server";
import { apiKeys, db } from "@nexora/database";
import { Alert, Badge, Card } from "@nexora/ui";

export const metadata: Metadata = {
  title: "Security",
};

function StatusRow({ label, value, ok }: { label: string; value: string; ok: boolean | null }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm">{value}</span>
        {ok === null ? null : (
          <Badge variant={ok ? "success" : "warning"}>{ok ? "Good" : "Review"}</Badge>
        )}
      </div>
    </div>
  );
}

export default async function SecurityPage() {
  const { orgId, userId } = await requireOrg();

  const [user, client] = await Promise.all([currentUser(), clerkClient()]);

  let activeSessionCount: number | null = null;
  try {
    const sessions = await client.sessions.getSessionList({ userId, status: "active" });
    activeSessionCount = sessions.data.length;
  } catch {
    activeSessionCount = null;
  }

  let memberCount: number | null = null;
  let adminCount: number | null = null;
  try {
    const memberships = await client.organizations.getOrganizationMembershipList({
      organizationId: orgId,
      limit: 100,
    });
    memberCount = memberships.data.length;
    adminCount = memberships.data.filter((m) => m.role === "org:admin").length;
  } catch {
    memberCount = null;
    adminCount = null;
  }

  let activeKeyCount: number | null = null;
  try {
    const rows = await db
      .select({ id: apiKeys.id })
      .from(apiKeys)
      .where(and(eq(apiKeys.orgId, orgId), isNull(apiKeys.revokedAt)));
    activeKeyCount = rows.length;
  } catch {
    activeKeyCount = null;
  }

  const mfaEnabled = user?.twoFactorEnabled ?? false;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        Console
      </span>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Security</h1>
      <p className="mt-2 max-w-xl text-muted-foreground">
        A snapshot of your account and organisation&rsquo;s security posture.
      </p>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <Card>
          <h2 className="font-semibold">Account security</h2>
          <div className="mt-2 divide-y divide-border">
            <StatusRow
              label="Multi-factor authentication"
              value={mfaEnabled ? "Enabled" : "Not enabled"}
              ok={mfaEnabled}
            />
            <StatusRow
              label="Active sessions"
              value={activeSessionCount === null ? "Unavailable" : String(activeSessionCount)}
              ok={null}
            />
          </div>
        </Card>

        <Card>
          <h2 className="font-semibold">Organisation security</h2>
          <div className="mt-2 divide-y divide-border">
            <StatusRow
              label="Members"
              value={memberCount === null ? "Unavailable" : String(memberCount)}
              ok={null}
            />
            <StatusRow
              label="Admins"
              value={adminCount === null ? "Unavailable" : String(adminCount)}
              ok={null}
            />
            <StatusRow
              label="Active API keys"
              value={activeKeyCount === null ? "Unavailable" : String(activeKeyCount)}
              ok={null}
            />
          </div>
        </Card>
      </div>

      {!mfaEnabled ? (
        <Alert className="mt-8">
          Multi-factor authentication isn&rsquo;t enabled on your account. Turn it on from{" "}
          <Link href="/organisation" className="text-primary hover:underline">
            account settings
          </Link>
          .
        </Alert>
      ) : null}
    </div>
  );
}
