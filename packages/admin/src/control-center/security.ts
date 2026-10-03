import tls from "node:tls";
import { and, count, desc, gte, like, ne } from "drizzle-orm";
import { auditEvents, db, productSuspensions } from "@nexora/database";
import { certificateHosts } from "./endpoints";
import { REPOS, githubGet, hasGithubToken } from "./github";
import { NotConnected } from "./result";

export type Severity = "critical" | "high" | "medium" | "low";
export type SeverityCounts = Record<Severity, number>;

const emptyCounts = (): SeverityCounts => ({ critical: 0, high: 0, medium: 0, low: 0 });

/** Maps whatever vocabulary an alert source uses onto the four buckets; unknown severities count as medium rather than disappearing. */
export function bucketSeverity(raw: unknown): Severity {
  switch (String(raw ?? "").toLowerCase()) {
    case "critical":
      return "critical";
    case "high":
    case "error":
      return "high";
    case "low":
    case "note":
      return "low";
    default:
      return "medium";
  }
}

interface CodeScanningAlert {
  rule?: { security_severity_level?: string | null; severity?: string | null };
}
interface DependabotAlert {
  security_advisory?: { severity?: string | null };
}

export function countCodeScanning(alerts: unknown): SeverityCounts {
  if (!Array.isArray(alerts)) throw new Error("unexpected code-scanning response");
  const counts = emptyCounts();
  for (const alert of alerts as CodeScanningAlert[]) {
    counts[bucketSeverity(alert.rule?.security_severity_level ?? alert.rule?.severity)] += 1;
  }
  return counts;
}

export function countDependabot(alerts: unknown): SeverityCounts {
  if (!Array.isArray(alerts)) throw new Error("unexpected dependabot response");
  const counts = emptyCounts();
  for (const alert of alerts as DependabotAlert[]) {
    counts[bucketSeverity(alert.security_advisory?.severity)] += 1;
  }
  return counts;
}

export interface RepoSecurity {
  repo: string;
  /** `null` means GitHub says the feature isn't available for this repo (disabled, or the token lacks access) — not "zero alerts". */
  codeScanning: SeverityCounts | null;
  dependabot: SeverityCounts | null;
  secrets: number | null;
}

export interface SecuritySummary {
  totals: SeverityCounts;
  secrets: number;
  repos: RepoSecurity[];
}

async function alertList(path: string): Promise<unknown | null> {
  const { status, body } = await githubGet(path);
  if (status === 200) return body;
  if (status === 403 || status === 404) return null;
  throw new Error(`GitHub answered ${status}`);
}

/** Open code-scanning, Dependabot and secret-scanning alerts across the three repos. Needs a token — GitHub requires auth for alert data even on public repos. */
export async function collectCodeSecurity(): Promise<SecuritySummary> {
  if (!hasGithubToken()) {
    throw new NotConnected(
      "GitHub security alerts",
      "Set GITHUB_TOKEN to a fine-grained token with read access to Code scanning alerts, Dependabot alerts, Secret scanning alerts, Actions and Metadata on the three repos.",
    );
  }

  const repos: RepoSecurity[] = await Promise.all(
    REPOS.map(async (repo) => {
      const [code, dependabot, secrets] = await Promise.all([
        alertList(`/repos/${repo}/code-scanning/alerts?state=open&per_page=100`),
        alertList(`/repos/${repo}/dependabot/alerts?state=open&per_page=100`),
        alertList(`/repos/${repo}/secret-scanning/alerts?state=open&per_page=100`),
      ]);
      return {
        repo,
        codeScanning: code === null ? null : countCodeScanning(code),
        dependabot: dependabot === null ? null : countDependabot(dependabot),
        secrets: Array.isArray(secrets) ? secrets.length : null,
      };
    }),
  );

  const totals = emptyCounts();
  let secrets = 0;
  for (const repo of repos) {
    for (const source of [repo.codeScanning, repo.dependabot]) {
      if (!source) continue;
      for (const severity of Object.keys(totals) as Severity[])
        totals[severity] += source[severity];
    }
    secrets += repo.secrets ?? 0;
  }
  return { totals, secrets, repos };
}

export interface CertificateResult {
  host: string;
  /** Whole days until the certificate expires; null when the handshake failed. */
  daysLeft: number | null;
}

export function daysUntil(validTo: string, now: number = Date.now()): number {
  return Math.floor((new Date(validTo).getTime() - now) / 86_400_000);
}

function certificateExpiry(host: string): Promise<CertificateResult> {
  return new Promise((resolve) => {
    const socket = tls.connect({ host, port: 443, servername: host, timeout: 5_000 }, () => {
      const validTo = socket.getPeerCertificate().valid_to;
      socket.end();
      resolve({ host, daysLeft: validTo ? daysUntil(validTo) : null });
    });
    socket.on("error", () => resolve({ host, daysLeft: null }));
    socket.on("timeout", () => {
      socket.destroy();
      resolve({ host, daysLeft: null });
    });
  });
}

/** Soonest-expiring first; Caddy renews at ~30 days left, so anything under that means renewal is failing. */
export async function collectCertificates(): Promise<CertificateResult[]> {
  const results = await Promise.all(certificateHosts().map(certificateExpiry));
  return results.sort((a, b) => (a.daysLeft ?? -1) - (b.daysLeft ?? -1));
}

export interface AdminAction {
  action: string;
  actorId: string;
  resourceType: string | null;
  resourceId: string | null;
  createdAt: Date;
}

export interface AccessSignals {
  suspendedProducts: number;
  failedEvents7d: number;
  recentAdminActions: AdminAction[];
}

/** What the platform itself recorded: product suspensions, failed events and the latest staff actions. */
export async function collectAccessSignals(): Promise<AccessSignals> {
  const since = new Date(Date.now() - 7 * 86_400_000);
  const [[suspended], [failed], recent] = await Promise.all([
    db.select({ n: count() }).from(productSuspensions),
    db
      .select({ n: count() })
      .from(auditEvents)
      .where(and(ne(auditEvents.outcome, "success"), gte(auditEvents.createdAt, since))),
    db
      .select({
        action: auditEvents.action,
        actorId: auditEvents.actorId,
        resourceType: auditEvents.resourceType,
        resourceId: auditEvents.resourceId,
        createdAt: auditEvents.createdAt,
      })
      .from(auditEvents)
      .where(like(auditEvents.action, "admin.%"))
      .orderBy(desc(auditEvents.createdAt))
      .limit(10),
  ]);
  return {
    suspendedProducts: suspended?.n ?? 0,
    failedEvents7d: failed?.n ?? 0,
    recentAdminActions: recent,
  };
}
