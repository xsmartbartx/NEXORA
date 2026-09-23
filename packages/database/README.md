# @nexora/database

The only package that talks to Postgres directly (§9.3). Owns three tables
— `api_keys`, `audit_events` and `subscriptions` — and nothing else: users
and organisations live in Clerk, never here (§13.1).

## Setup

1. Copy `.env.example` to `.env` and point `DATABASE_URL` at a real Postgres
   instance (local, Docker, or a managed provider — the stack doc suggests
   Supabase, but any Postgres works).
2. From this directory:

   ```bash
   npm run db:generate   # diff schema.ts against the last migration
   npm run db:migrate    # apply pending migrations
   npm run db:studio     # browse the database
   ```

Every app that touches Postgres degrades to a "database not reachable"
message instead of crashing when `DATABASE_URL` is a placeholder (see
`apps/console`'s API Keys, Billing, Usage and Analytics pages for the
pattern). Verified end-to-end against a real local Postgres:

- `apps/api` — key creation, auth rejection (missing/invalid key), rate
  limiting and `last_used_at` tracking (Phase 3).
- `packages/billing` — Stripe webhook signature verification and
  subscription upsert-by-org semantics against the `subscriptions` table
  (Phase 5, provider switched in [ADR-0011](../../docs/adr/ADR-0011-billing-provider-selection.md)).
- `packages/telemetry` — cross-organisation isolation and day-bucketed
  usage queries against `audit_events` (Phases 4 and 6).
