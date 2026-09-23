# NEXORA

> Build What's Next. — Technology · AI · Security

NEXORA is a technology platform. Its products are intelligent software, AI
systems and secure digital products that share one account, one console, one
API surface and one operational backbone.

This repository (`nexora-platform`) holds the website, console, account,
API, docs and product applications, plus the shared packages they all
consume. Gateway's product repository will live separately and consume this
platform as a tenant once it exists — see the architecture document for the
full model.

## Read first

The platform architecture, principles, phased build plan and contracts are
defined in
[`docs/NEXORA-PLATFORM-ARCHITECTURE.md`](docs/NEXORA-PLATFORM-ARCHITECTURE.md).
Read it before making a structural change.

## Repository layout

```
apps/
  website/          onenexora.com — marketing site
  account/           account.onenexora.com — profile, security, organisations
  console/           console.onenexora.com — the org-scoped control plane
  status/            status.onenexora.com — manually maintained component status
  api/               api.onenexora.com — the public v1 API
  docs/              docs.onenexora.com — quickstart, concepts, reference
  developers/        developers.onenexora.com — developer landing page
  sentinel/          sentinel.onenexora.com — AI Cloud Log Sentinel (beta)
  cspm/              cspm.onenexora.com — NEXORA CSPM (beta)
packages/
  ui/                design tokens and shared UI primitives
  registry/          Product Registry: entity types and query layer
  auth/              identity boundary — every app talks to Clerk through here
  shell/             shared header/product-switcher/account-menu for authenticated apps
  database/          Postgres access — api_keys and audit_events only
  entitlements/      what an organisation is allowed to do (stub until Phase 5 billing)
  telemetry/         event emission/read helpers, built on packages/database
  config/            shared TypeScript / lint / format configuration
infrastructure/       DNS, edge, deployment (provisioned per environment)
docs/                 architecture, ADRs and supporting documents
```

See §9.2 of the architecture document for the full target layout as more
apps and packages are added. Note: §9.1 describes `nexora-core-api` and each
product as their own repositories long-term; they live in this monorepo for
now, alongside everything else built so far — splitting repos apart is a
later, separate decision.

## Build status

| Phase | Scope                                                     | Status         |
| ----- | --------------------------------------------------------- | -------------- |
| 0     | Foundations: monorepo, CI, design tokens, base UI package | ✅ Done        |
| 1     | Product Registry and marketing website                    | ✅ Done        |
| 2     | Identity, Account and Console                             | ✅ Scaffolded  |
| 3     | API, Docs and Developer surface                           | ✅ Scaffolded  |
| 4     | Sentinel and CSPM as platform tenants                     | ✅ Scaffolded  |
| 5     | Gateway, Billing and Labs                                 | ⬜ Not started |
| 6     | Marketplace and scale                                     | ⬜ Not started |

"Scaffolded" means the code is real, builds/typechecks/lints clean, and
degrades gracefully instead of crashing — but ships with placeholder Clerk
and Postgres credentials (see below), so sign-in isn't usable until real
Clerk keys are set. **Two things don't need Clerk and were verified against
real infrastructure, not just typechecked:**

- **The API** — key creation, auth rejection, rate limiting and usage
  tracking, against a real local Postgres.
- **Sentinel and CSPM's core engines** — the log-anomaly detector and the
  cloud-config rule scanner are pure functions, unit-tested directly with
  realistic mixed data (clean resources stay clean, every rule fires
  correctly). Cross-organisation isolation for usage events (Console's
  Usage page) was also verified against real Postgres: one org's events
  never leak into another's query.

Both products are honestly scoped: real statistical/rule-based analysis on
data _you_ paste in today, not a live-connected cloud integration — see
each product's own page and [`apps/docs`](apps/docs)`/products` for exactly
what that means.

## Before this goes live

**Identity and database.** Every app that needs Clerk reads
`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` from its own
`.env.local` (copy each app's `.env.example`); `apps/console`, `apps/api`,
`apps/sentinel` and `apps/cspm` additionally need `DATABASE_URL` pointed at
a real Postgres instance (see
[`packages/database/README.md`](packages/database/README.md) for
migrations). Until then, every protected route across every app renders a
clear "Setup required" or "not reachable" message instead of crashing.

**Two more placeholders**, flagged `TODO(launch)` at
[`apps/website/src/lib/site-config.ts`](apps/website/src/lib/site-config.ts):

- `onenexora.com` is not registered/DNS-configured yet — every app's URL env
  vars fall back to its intended `*.onenexora.com` subdomain.
- `hello@onenexora.com` is not a verified, monitored inbox — it's the site's
  only contact method (`/company#contact`).

## Getting started

Requires Node.js 20+.

```bash
npm install
npm run dev
```

The website app starts at `http://localhost:3000`. To run every app at once
(website `3000`, account `3001`, console `3002`, status `3003`, api `3004`,
docs `3005`, developers `3006`, sentinel `3007`, cspm `3008`), start each
with `npm run dev --workspace apps/<name>` in its own terminal, or use this
project's `.claude/launch.json` configurations.

## Scripts

Run from the repository root; each fans out to every workspace that defines
the script.

| Command                | Does                                       |
| ---------------------- | ------------------------------------------ |
| `npm run dev`          | Starts the website app in development mode |
| `npm run build`        | Production build of every app and package  |
| `npm run lint`         | ESLint across every workspace              |
| `npm run typecheck`    | `tsc --noEmit` across every workspace      |
| `npm run format`       | Formats the repository with Prettier       |
| `npm run format:check` | Checks formatting without writing          |

## License

See [LICENSE](LICENSE).
