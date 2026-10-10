/**
 * Scopes an API key can carry (`api_keys.scopes`). The plain, scope-less key is
 * the common read-only API key; a scope opts a key into one integration, so a
 * key made for one cannot be used for another (§6.4, least privilege).
 */
export const NEURAWALL_LINK_SCOPE = "neurawall:link";
