# Cloudflare in front of onenexora.com: cutover runbook

Why: the 14 hostnames point straight at the VM, so the origin IP is public and there is no WAF, DDoS cover or CDN. Cloudflare's free plan adds all three. The DNS provider changes (Squarespace to Cloudflare nameservers); the registrar stays at Squarespace. The account steps below are the owner's: nothing here can be done from the repo.

Read 2026-10-30 from the host, so check against the registrar's DNS page before the switch.

## Records to carry over

Read from Squarespace's DNS page on 2026-10-31 (the 2026-10-30 lookup from the host missed hostnames it did not know to ask for, so use this list, not the earlier one). All A records point at the VM.

| name                                                                                                        | type  | Cloudflare proxy                                                                                                                           |
| ----------------------------------------------------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `@`, `www`, `account`, `console`, `api`, `status`, `docs`, `developers`, `sentinel`                         | A     | **Proxied** (orange). `sentinel` only redirects to Linegist now                                                                            |
| `gateway`, `cspm`, `gateway-next`, `gateway-next-api`, `app`, `app.cspm`, `api.cspm`                        | A     | **DNS only**: Gateway and CSPM are stopped or moved on purpose; leave them out of the proxy until their new homes are settled              |
| `linegist`, `omniflow`, `www.omniflow`, `neurawall`, `neurawall-demo`, `vigilo`, `vigilo-api`, `monitoring` | A     | **DNS only** at first (other products, agents and Grafana); proxy later, one at a time                                                     |
| `accounts`, `clerk`, `clkmail`, `clk._domainkey`, `clk2._domainkey`                                         | CNAME | **DNS only**: Clerk and its mail provider must stay reachable directly (targets under `clerk.services`)                                    |
| `_domainconnect`                                                                                            | CNAME | **DNS only**; only Squarespace's Domain Connect uses it, safe to drop once DNS has moved                                                   |
| `@`                                                                                                         | MX    | `smtp.google.com`, priority 1 (not proxiable)                                                                                              |
| `@`                                                                                                         | TXT   | `v=spf1 include:_spf.google.com ~all` and the `google-site-verification=...` value                                                         |
| `google._domainkey`                                                                                         | TXT   | the Workspace DKIM key                                                                                                                     |
| `_dmarc`                                                                                                    | TXT   | `v=DMARC1; p=none; rua=mailto:security@onenexora.com` (**not yet added**; add it in Cloudflare after the switch, or at Squarespace before) |

Squarespace requires a Google sign-in re-verification before it accepts any DNS change; that step is the owner's.

Cloudflare auto-imports records when the site is added; compare its list with this table and add anything missing (an unlisted record at Squarespace would silently vanish at the switch).

## Order (matters)

1. **Turn DNSSEC off at Squarespace first.** A DS record is published today. Changing nameservers with it in place makes validating resolvers reject the domain. Turn DNSSEC off at Squarespace; the registry can take up to 48 hours to drop the DS record (check with `dig DS onenexora.com`), and resolvers may cache it for its TTL, 24 hours for .com. **Change the nameservers only once the DS record is gone from the .com servers and at least 24 hours have passed since.** (An earlier version of this runbook said an hour; that is not enough.)
2. Create the Cloudflare account (free plan), add `onenexora.com`, review the imported records, set the proxy flags above.
3. **SSL/TLS: set the mode to "Full (strict)" before the switch.** Caddy has valid Let's Encrypt certificates. Never use "Flexible" (redirect loops, plain HTTP to the origin).
4. At Squarespace, replace the four `nsd*.squarespacedns.com` nameservers with the two Cloudflare gives you. The records are identical, so the cut is seamless. Cloudflare emails when the zone is active.
5. In Cloudflare, enable DNSSEC and put the DS record it shows into Squarespace.
6. Settings to leave off or avoid: **Bot Fight Mode off** (it challenges datacentre IPs, which breaks the GitHub uptime probe and could block Stripe and Clerk webhooks); **no "Cache Everything"** (the site sends year-long `s-maxage` on HTML, so deploys would not show); Rocket Loader, Auto Minify and Email Address Obfuscation off (they can break Next.js hydration). Free-plan proxy timeout is 100 s: Gateway caps output at 1024 tokens, fine.

## Verify right after the switch

- `npm run test:e2e` (31 cases; the header and redirect checks should still pass: Cloudflare passes our headers through and adds `server: cloudflare`).
- Trigger the Uptime workflow by hand and expect all green.
- Sign in with Google at account.onenexora.com; open Console.
- Send a Stripe test webhook event and confirm a 200 in the dashboard; Clerk sends a webhook on sign-up.
- Send a message to `hello@` and `security@onenexora.com` (mail does not go through the proxy, but check anyway).
- About 3 weeks later the Let's Encrypt certificates renew (current expiry 2026-12-25, renewal around 2026-11-25): confirm Caddy renewed; the HTTP-01 challenge passes through the proxy.

## Roll back

Put the four Squarespace nameservers back (and re-add the DS record if DNSSEC was on). Takes effect as fast as the NS TTL.

## Later: hide the origin (optional)

Once everything is proxied for a few weeks, restrict ports 80 and 443 on the VM's security list to Cloudflare's published ranges (https://www.cloudflare.com/ips) and reserve the OCI IP. Do not do this while Vigilo, NeuraWall or Grafana are DNS-only, and check that nothing else on the host needs direct access. Without it the origin is still reachable by IP, just no longer discoverable from DNS.

## Not needed

No app or Caddy change is required: no NEXORA code reads the client IP (rate limits are per API key). Logs will show Cloudflare addresses; `CF-Connecting-IP` carries the real one if that ever matters.
