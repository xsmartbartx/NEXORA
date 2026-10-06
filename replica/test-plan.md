# NEXORA test plan (2026-10-06)

Rule applied: read-only against production plus rejected requests. No sign-in, no payments, no data written.

| flow | automated now | needs a signed-in browser or live provider (manual) |
| --- | --- | --- |
| F01 visitor to paid org | public pages 200, 404, security.txt, anonymous redirects (e2e/smoke.spec.ts) | Google OAuth sign-in, org creation, Stripe Checkout (live mode only, no test mode) |
| F02 first scan | engine unit tests (vitest, 189 pass) | run a scan in Sentinel, see it in Console Usage |
| F03 API key lifecycle | no key / bogus key rejection (smoke + Postman prod folder) | create, use, revoke (verified by hand 2026-10-01) |
| F04 gateway | no-key rejection (smoke); proxy logic in unit tests | real upstream call, free-limit block |
| F05 plan sync | Stripe, Clerk and Vigilo webhook signature rejection (smoke); sync logic in unit tests | a real subscription event end to end |
| F06 NeuraWall SSO | none | known broken until a matching NeuraWall user exists |
| F07 staff ops | /admin redirects anonymous users (smoke) | staff-only views, non-staff 404 |

Edge cases still to cover when a test org exists: two tabs, double submit on key creation, expired session, org A cannot see org B (covered in DB tests for usage events only), mobile width, keyboard-only, axe scan.
Run: `npm run test:e2e` (E2E_DOMAIN overrides the domain).

## Results
Unit: 26 files, 189 tests, all pass. Postman production contract: 15 assertions, all pass.
E2E smoke: 29 cases, 19 pass, 10 fail before the fix (B-001, one per host).
