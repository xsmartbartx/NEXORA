const STATE_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;
const DEFAULT_NEURAWALL_URL = "https://neurawall.onenexora.com";

export function isValidHandoffState(state: string | null): state is string {
  return state !== null && STATE_PATTERN.test(state);
}

/**
 * Where a signed-in user is sent after minting a short-lived token for
 * NeuraWall. The destination is the configured NeuraWall origin only, never
 * a caller-supplied URL (no open redirect). The token travels in the URL
 * fragment, which browsers do not send to servers or put in Referer headers
 * or access logs; `state` is the caller's own random nonce, echoed back so
 * NeuraWall can reject a token it did not ask for (login CSRF).
 */
export function buildNeurawallHandoffUrl(token: string, state: string, baseUrl?: string): string {
  const origin = new URL(baseUrl ?? DEFAULT_NEURAWALL_URL).origin;
  return `${origin}/#sso_token=${encodeURIComponent(token)}&state=${state}`;
}
