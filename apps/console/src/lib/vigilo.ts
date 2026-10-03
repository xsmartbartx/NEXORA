export interface VigiloAccount {
  planId: string;
  scansPerMonthLimit: number | null;
  targetsLimit: number | null;
}

const DEFAULT_API_URL = "https://vigilo-api.onenexora.com";

/**
 * Reads the signed-in user's Vigilo plan through Vigilo's own `GET /v1/me`,
 * authenticated with a Clerk token minted from the shared Clerk instance.
 * Vigilo stays the source of truth for its subscription (its own database
 * and Stripe webhook); Console only displays it. Any failure — Vigilo down,
 * template missing, unexpected shape — returns null so the billing page
 * degrades to a plain link instead of breaking.
 */
export async function fetchVigiloAccount(
  token: string,
  options: { baseUrl?: string; fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<VigiloAccount | null> {
  const baseUrl = (options.baseUrl ?? process.env.VIGILO_API_URL ?? DEFAULT_API_URL).replace(
    /\/$/,
    "",
  );
  const doFetch = options.fetchImpl ?? fetch;
  try {
    const response = await doFetch(`${baseUrl}/v1/me`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(options.timeoutMs ?? 4000),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const body: unknown = await response.json();
    const entitlements = (body as { entitlements?: Record<string, unknown> } | null)?.entitlements;
    if (!entitlements || typeof entitlements.plan_id !== "string") return null;
    const numberOrNull = (value: unknown) => (typeof value === "number" ? value : null);
    return {
      planId: entitlements.plan_id,
      scansPerMonthLimit: numberOrNull(entitlements.scans_per_month_limit),
      targetsLimit: numberOrNull(entitlements.targets_limit),
    };
  } catch {
    return null;
  }
}
