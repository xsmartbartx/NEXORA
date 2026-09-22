# @nexora/database

The only package that talks to Postgres directly (§9.3). Owns two tables —
`api_keys` and `audit_events` — and nothing else: users and organisations
live in Clerk, never here (§13.1).

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

Two apps read from this package:

- `apps/console`'s API Keys page — degrades to a "database not reachable"
  message instead of crashing when `DATABASE_URL` is a placeholder (see that
  page's own try/catch).
- `apps/api` — every `/v1` endpoint except `/v1/health` authenticates
  against `api_keys` here. Verified end-to-end against a real local
  Postgres during Phase 3: key creation, auth rejection (missing/invalid
  key), rate limiting, and `last_used_at` tracking all confirmed working.
