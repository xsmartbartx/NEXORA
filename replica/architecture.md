# NEXORA architecture (as-is audit, 2026-10-06)

## Stack
Next.js App Router + TS monorepo (npm workspaces) | Clerk (auth, orgs, Google OAuth) | Postgres + Drizzle |
Stripe live (Checkout + webhooks) | Redis rate limiter (api-kit) | Docker Compose on one OCI VM (Frankfurt) behind Caddy |
GitHub Actions (ci, api-tests, release, uptime) | Sentry. No microservices; 10 apps share 10 packages.

## Schema (6 tables, packages/database/drizzle 0000-0005)
api_keys, audit_events, subscriptions (unique org_id+product), product_suspensions (unique org_id+product),
ops_checklist_completions, ops_costs. org_id/actor_id are Clerk ids (text, no FKs by design: identity lives in Clerk).
Access rule: per-query org scoping in the data layer (no RLS). Cross-org isolation tested for usage events.

## API (apps/api, apps/gateway)
GET /v1/health, /v1/products, /v1/products/[slug]; POST /v1/webhooks/clerk, /v1/webhooks/stripe (signature verified);
POST gateway /v1/chat (API key + entitlement + audit); Vigilo POST /v1/internal/org-plan (HMAC). Console/Account use server actions + Clerk sessions.

## Gaps found
| # | gap | severity | fix |
| --- | --- | --- | --- |
| A1 | No index on api_keys.key_hash: every authenticated API/Gateway call scans the table | high (perf, grows with keys) | unique index on key_hash |
| A2 | No index on api_keys.org_id | medium | index (org_id) where revoked_at is null |
| A3 | No index on audit_events (org_id, created_at): Usage/Analytics/entitlement counts scan the table, and it grows with every call | high | index (org_id, action, created_at) |
| A4 | subscriptions.status / action / outcome are free text, no check constraints | low | check constraints |
| A5 | No retention policy on audit_events | medium | job to archive/delete >N days; GDPR deletion path per org |
| A6 | Single VM, single operator, no HA; DB backups unverified in repo | high (ops) | restore drill, documented RPO/RTO |
| A7 | Stripe has no test mode on this account | medium | create a test-mode account for CI billing tests |
| A8 | Webhook idempotency: confirm stripe event ids are deduped (upserts are idempotent by org+product, ok for subscriptions) | low | store processed event ids |

Proposed SQL for A1-A4 is in replica/schema.sql (NOT applied; needs a Drizzle migration and your go-ahead; use CREATE INDEX CONCURRENTLY on prod).

## Build order (if gaps are closed)
1. A1+A3 indexes (smallest, biggest win). 2. A4 constraints. 3. A5 retention job. 4. A6 backup/restore drill. 5. A7 test-mode billing in CI.
