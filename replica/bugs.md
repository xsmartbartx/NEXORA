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
