import type { CodeReviewerPlanId } from "@nexora/billing";

/**
 * A request from CodeReviewer to link one of its accounts (a GitHub user or
 * organisation that installed the app) to the active organisation (ADR-0015).
 * CodeReviewer started it after a fresh GitHub sign-in by the account's owner or
 * installer; Console adds an organisation admin's consent and hands back a signed
 * grant. All three fields are only echoed: CodeReviewer checks them against the
 * single-use request this browser started, so nothing here is trusted for access.
 */
export interface CodeReviewerLinkRequest {
  accountId: string;
  login: string;
  nonce: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// GitHub user and organisation logins.
const LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const NONCE = /^[A-Za-z0-9_-]{32,64}$/;

type Source = Record<string, string | string[] | undefined> | FormData;

function field(source: Source, name: string): string | null {
  const value = source instanceof FormData ? source.get(name) : source[name];
  return typeof value === "string" ? value : null;
}

export function parseLinkRequest(source: Source): CodeReviewerLinkRequest | null {
  const accountId = field(source, "account");
  const login = field(source, "login");
  const nonce = field(source, "nonce");
  if (!accountId || !UUID.test(accountId)) return null;
  if (!login || !LOGIN.test(login)) return null;
  if (!nonce || !NONCE.test(nonce)) return null;
  return { accountId, login, nonce };
}

/** The organisation's resolved CodeReviewer plan, in CodeReviewer's plan ids. */
export function codereviewerPlanId(tier: string): CodeReviewerPlanId {
  return tier === "pro" || tier === "team" ? tier : "free";
}
