# Bugs

## B-001 No security headers on any NEXORA host (S2)
- Steps: `curl -sI https://console.onenexora.com/` (same on every NEXORA host).
- Expected: HSTS, X-Content-Type-Options nosniff, X-Frame-Options, Referrer-Policy; no X-Powered-By.
- Actual: none of them; `x-powered-by: Next.js` is sent. Console's billing and API-key pages can be framed (clickjacking).
- Evidence: 10 failing cases in e2e/smoke.spec.ts, one per host.
- Fix: `security_headers` snippet in infrastructure/edge/Caddyfile (config validated with caddy:2). Branch test/e2e-smoke-security-headers. Not deployed.
- Not fixed here: a Content-Security-Policy (needs testing with Clerk and Stripe).

## To check (not reproduced as bugs)
- Stripe webhook returns 401 on a bad signature; Stripe only needs non-2xx, but 400 is the convention. Its error body also echoes Stripe's long verification message (S4).
- onenexora.com/ is served with `s-maxage=31536000`: a year at the CDN/edge cache. Confirm a deploy invalidates it.
- Sentinel, CSPM, Gateway, Console authenticated flows and org isolation across tenants were not exercised in this run.

## B-002 NEXORA containers do not restart after a reboot or crash (S2) - FIXED 2026-10-07 (PR #49, policy applied live)
- Steps: `docker inspect -f '{{.HostConfig.RestartPolicy.Name}}' nexora-api-1` on the host (same for postgres, redis and the apps).
- Expected: `unless-stopped` (the edge Caddy has it).
- Actual: `no` for 19 containers; no boot unit or cron brings them up. Memory limit is 0 for all.
- Fix: add `restart: unless-stopped` to the services in docker-compose.prod.yml; optionally `docker update --restart unless-stopped $(docker ps -q --filter name=nexora-)` now. Consider memory limits next (the host is shared with Vigilo and NeuraWall).
- Source: the external analysis in recon.md section 10 asked about hardening; this was found while verifying it.
