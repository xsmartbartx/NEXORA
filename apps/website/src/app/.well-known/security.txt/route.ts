import { siteConfig } from "@/lib/site-config";

/**
 * RFC 9116 security.txt. `Expires` must be a real date, not far out — a
 * year from now, refreshed whenever this file is next touched.
 */
export function GET() {
  const body = `Contact: mailto:${siteConfig.securityEmail}
Expires: 2027-09-27T00:00:00.000Z
Preferred-Languages: en
Canonical: ${siteConfig.siteUrl}/.well-known/security.txt
Policy: ${siteConfig.siteUrl}/legal/security
`;

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
