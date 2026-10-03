import { createSign } from "node:crypto";
import { NotConnected, timedFetch } from "./result";

export interface VisitorWindow {
  /** GA4 "active users" — people who had an engaged session in the window. */
  users: number;
  sessions: number;
  newUsers: number;
}

export interface VisitorSummary {
  last7d: VisitorWindow;
  last30d: VisitorWindow;
}

interface ServiceAccount {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

const SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
const CACHE_MS = 5 * 60_000;

const base64url = (input: string | Buffer) => Buffer.from(input).toString("base64url");

/**
 * The key arrives base64-encoded (GA4_SERVICE_ACCOUNT_B64): the raw JSON has
 * quotes and `\n` escapes that env files and compose interpolation mangle.
 */
export function parseServiceAccount(encoded: string): ServiceAccount {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
  } catch {
    throw new Error("GA4_SERVICE_ACCOUNT_B64 is not base64-encoded JSON");
  }
  const key = parsed as Partial<ServiceAccount>;
  if (!key.client_email || !key.private_key) {
    throw new Error("GA4_SERVICE_ACCOUNT_B64 is missing client_email or private_key");
  }
  return { client_email: key.client_email, private_key: key.private_key, token_uri: key.token_uri };
}

/** A signed RS256 JWT assertion for Google's service-account token exchange. */
export function signAssertion(account: ServiceAccount, nowSeconds: number): string {
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: account.client_email,
      scope: SCOPE,
      aud: account.token_uri ?? "https://oauth2.googleapis.com/token",
      iat: nowSeconds,
      exp: nowSeconds + 3600,
    }),
  );
  const signature = createSign("RSA-SHA256")
    .update(`${header}.${claims}`)
    .sign(account.private_key);
  return `${header}.${claims}.${base64url(signature)}`;
}

interface ReportRow {
  dimensionValues?: { value?: string }[];
  metricValues?: { value?: string }[];
}

/**
 * With two date ranges GA4 adds a `dateRange` dimension ("date_range_0",
 * "date_range_1") to each row, in the order the ranges were requested.
 */
export function parseReport(json: unknown): VisitorSummary {
  const rows = (json as { rows?: ReportRow[] } | null)?.rows;
  if (!Array.isArray(rows)) {
    // GA4 omits `rows` entirely when there was no traffic at all.
    if (json && typeof json === "object") return { last7d: emptyWindow(), last30d: emptyWindow() };
    throw new Error("unexpected Google Analytics response");
  }
  const windows: Record<string, VisitorWindow> = {};
  for (const row of rows) {
    const name = row.dimensionValues?.[0]?.value;
    const metrics = (row.metricValues ?? []).map((m) => Number(m.value ?? 0));
    if (!name || metrics.some((n) => !Number.isFinite(n))) continue;
    windows[name] = {
      users: metrics[0] ?? 0,
      sessions: metrics[1] ?? 0,
      newUsers: metrics[2] ?? 0,
    };
  }
  return {
    last7d: windows["date_range_0"] ?? emptyWindow(),
    last30d: windows["date_range_1"] ?? emptyWindow(),
  };
}

const emptyWindow = (): VisitorWindow => ({ users: 0, sessions: 0, newUsers: 0 });

let tokenCache: { token: string; expiresAt: number } | null = null;
let reportCache: { at: number; data: VisitorSummary } | null = null;

async function accessToken(account: ServiceAccount): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 60_000) return tokenCache.token;

  const response = await timedFetch(account.token_uri ?? "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: signAssertion(account, Math.floor(now / 1000)),
    }),
  });
  if (!response.ok) throw new Error(`Google sign-in answered ${response.status}`);
  const body = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!body.access_token) throw new Error("Google sign-in returned no token");
  tokenCache = { token: body.access_token, expiresAt: now + (body.expires_in ?? 3600) * 1000 };
  return body.access_token;
}

/** Visitors from the GA4 Data API, read with a read-only service account. */
export async function collectVisitors(): Promise<VisitorSummary> {
  const propertyId = process.env.GA4_PROPERTY_ID;
  const encoded = process.env.GA4_SERVICE_ACCOUNT_B64;
  if (!propertyId || !encoded) {
    throw new NotConnected(
      "Visitors (Google Analytics)",
      "Set GA4_PROPERTY_ID and GA4_SERVICE_ACCOUNT_B64 (a base64-encoded read-only service-account key added as a Viewer on the property).",
    );
  }
  if (!/^\d+$/.test(propertyId)) throw new Error("GA4_PROPERTY_ID must be the numeric property id");

  if (reportCache && Date.now() - reportCache.at < CACHE_MS) return reportCache.data;

  const account = parseServiceAccount(encoded);
  const token = await accessToken(account);
  const response = await timedFetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        dateRanges: [
          { startDate: "7daysAgo", endDate: "today" },
          { startDate: "30daysAgo", endDate: "today" },
        ],
        metrics: [{ name: "activeUsers" }, { name: "sessions" }, { name: "newUsers" }],
      }),
    },
  );
  if (!response.ok) throw new Error(`Google Analytics answered ${response.status}`);

  const data = parseReport(await response.json());
  reportCache = { at: Date.now(), data };
  return data;
}
