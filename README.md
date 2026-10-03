# NEXORA

> Build What's Next. — Technology · AI · Security

NEXORA is a technology platform. Its products are intelligent software, AI
systems and secure digital products that share one account, one console, one
API surface and one operational backbone.

This repository (`nexora-platform`) holds the website, console, account,
API, docs and every product app, plus the shared packages they all consume
— see the architecture document for the full model.

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
  api/               api.onenexora.com — the public v1 API + Stripe webhook
  docs/              docs.onenexora.com — quickstart, concepts, reference
  developers/        developers.onenexora.com — developer landing page
  sentinel/          sentinel.onenexora.com — AI Cloud Log Sentinel (beta)
  cspm/              cspm.onenexora.com — NEXORA CSPM (beta)
  gateway/           gateway.onenexora.com — Secure AI Gateway (beta)
packages/
  ui/                design tokens and shared UI primitives
  registry/          Product Registry + Labs Experiments + Marketplace listings + product integrations: entity types and query layer
  auth/              identity boundary — every app talks to Clerk through here
  shell/             shared header/product-switcher/account-menu for authenticated apps
  database/          Postgres access — api_keys, audit_events, subscriptions
  billing/            Stripe integration: plan catalog, webhook verification, subscription sync
  entitlements/      real plan-based usage limits, fed by billing + telemetry
  telemetry/         event emission/read helpers, built on packages/database
  api-kit/           the error contract, rate limiting and API-key-auth wrapper every machine endpoint shares
  config/            shared TypeScript / lint / format configuration
infrastructure/
  docker/            one Dockerfile builds any app; docker-compose.yml runs all 10 + Postgres locally
docs/                 architecture, ADRs and supporting documents
```

See §9.2 of the architecture document for the full target layout as more
apps and packages are added. Note: §9.1 describes `nexora-core-api` and each
product as their own repositories long-term; they live in this monorepo for
now, alongside everything else built so far — splitting repos apart is a
later, separate decision.

## Build status

| Phase | Scope                                                     | Status                                               |
| ----- | --------------------------------------------------------- | ---------------------------------------------------- |
| 0     | Foundations: monorepo, CI, design tokens, base UI package | ✅ Done                                              |
| 1     | Product Registry and marketing website                    | ✅ Done                                              |
| 2     | Identity, Account and Console                             | ✅ Done — live in production                         |
| 3     | API, Docs and Developer surface                           | ✅ Done — live in production                         |
| 4     | Sentinel and CSPM as platform tenants                     | ✅ Done — live in production                         |
| 5     | Gateway, Billing and Labs                                 | ✅ Done — live in production                         |
| 6     | Marketplace and scale                                     | ✅ Done — two items deliberately deferred, see below |

Every app is deployed to a real Oracle Cloud instance behind Caddy/HTTPS at
its real `onenexora.com` subdomain, running against real Clerk (including
Google OAuth), real Postgres, and real Stripe in live mode (account
activated, payments and payouts enabled) — not placeholder credentials.

**The full visitor → sign-up → account → organisation → console → product →
usage → billing → API flow has been walked end-to-end against this real
production infrastructure** (2026-10-01): signed in via Google OAuth,
loaded an existing organisation, opened Console and saw its real plans,
API key count and live platform status; ran a real Sentinel scan from the
product app and confirmed it appeared in Console's Usage feed seconds
later; confirmed Console's Billing page reflects real Stripe usage counts
and billing-period dates, not placeholder numbers; created a real API key,
used it to authenticate a request against `api.onenexora.com` (confirmed
by the real `X-RateLimit-*` response headers), then revoked it and
confirmed the same request was rejected with 401 immediately after. No
step in this chain renders a "Setup required" page in production.

**Everything below was verified against real infrastructure, not just
typechecked:**

- **The API** — key creation, auth rejection, rate limiting and usage
  tracking, against a real local Postgres.
- **Sentinel and CSPM's core engines** — pure functions, unit-tested
  directly with realistic mixed data (clean resources stay clean, every
  rule fires correctly).
- **Billing end-to-end** — Stripe webhook signature verification, using
  Stripe's own test-signature generator (valid, tampered, wrong secret,
  malformed/missing header all correctly accepted/rejected) and
  subscription sync, against real Postgres: plan mapping, upsert-by-org
  semantics (a resubscribe with a new Stripe subscription id updates the
  same row, not a second one), an orphan-row guard (an event with no
  `orgId` in metadata throws instead of writing unassociated data), and
  real entitlement enforcement (a free-plan org is genuinely blocked at its
  limit; a pro-plan org isn't). Provider choice explained in
  [ADR-0011](docs/adr/ADR-0011-billing-provider-selection.md).
- **Gateway's proxy** — authenticated against a real API key, relayed
  through a local mock upstream standing in for the AI provider: auth
  rejection, input validation, upstream error propagation, audit logging,
  and entitlement blocking at the free-tier limit all confirmed working.
- **Cross-organisation isolation** for usage events — one org's events
  never leak into another's query, verified against real Postgres.
- **Per-product analytics** — the day-bucketed usage query behind Console's
  Analytics page, verified against real Postgres: correct per-day counts,
  correct billing-period totals, and cross-organisation isolation
  re-confirmed for this new query independently of the Phase 4 test.
- **Marketplace taxonomy extensibility** — the Phase 6 exit criterion ("a
  listing type other than product can be added without a schema rewrite")
  verified the same way Phase 1 verified SC-1: added a throwaway listing of
  a new kind and a throwaway product integration, confirmed both rendered
  correctly on `/marketplace` and a product page, removed them. See
  [`docs/adr/ADR-0013-marketplace-listing-taxonomy.md`](docs/adr/ADR-0013-marketplace-listing-taxonomy.md)
  for the design.
- **Docker** — every app builds to a real, standalone container image from
  [`infrastructure/docker/Dockerfile`](infrastructure/docker/Dockerfile):
  `website` (no external dependencies) built, ran, and served real pages
  and a static asset from inside the container; `console` (needs Clerk +
  Postgres) built with placeholder env and correctly served the same
  "Setup required" page it does locally; the full 10-app +
  Postgres [`docker-compose.yml`](infrastructure/docker/docker-compose.yml)
  stack came up together, ran real migrations against its own Postgres,
  and every app responded `200`, with `sentinel`/`cspm`/`gateway`/`api`'s
  health checks confirming their database connection specifically — see
  [`infrastructure/docker/README.md`](infrastructure/docker/README.md).

Every product is honestly scoped: real statistical/rule-based/proxy logic
on data or a request _you_ provide today, not the eventual live-connected
vision — see each product's own page and the docs app's `/products` page
for exactly what that means. **Plan names and prices are explicit
placeholders** — see
[`packages/billing/src/plans.ts`](packages/billing/src/plans.ts) — pricing
is a business decision, not one this build makes for you.

**Two Phase 6 deliverables were deliberately not pursued**, per the
architecture doc's own conditional phrasing ("if demanded" / "if
pursued" — §14.3 Phase 6): multi-region/data-residency options, since
nothing today runs in more than one region or has asked to; and a
partner/third-party listing model, since NEXORA has no partners yet. The
marketplace's `provider: "nexora" | "partner"` field exists so the first
real partner listing is a data change when one is actually pursued —
building the onboarding flow for a partner program that doesn't exist yet
would be exactly the kind of fabricated scope this build avoids elsewhere.

## Production status

Live at [onenexora.com](https://onenexora.com) on a real Oracle Cloud
instance (Frankfurt), behind Caddy/HTTPS, running real Clerk (with Google
OAuth), real Postgres, and real Stripe in live mode — see
`infrastructure/docker/docker-compose.prod.yml` for the deployed topology.
`packages/api-kit`'s rate limiter is Redis-backed (`redis` service in that
compose file) and shared across every replica of `api`/`gateway`, not the
in-memory, per-instance limiter this section used to describe.

**What's still genuinely open, not done:**

- **Legal.** [`/legal`](apps/website/src/app/legal) has a real Terms of
  Service, Privacy Policy and Security Statement — not filler text, but a
  draft written by an AI assistant, not a lawyer, marked as such on every
  page. It references a legal entity, jurisdiction and registered address
  that don't exist yet (`site-config.ts`). A lawyer needs to review these
  — for the jurisdictions NEXORA actually operates in, including whether
  operating as an unregistered individual is sufficient for recurring
  paid subscriptions, EU consumer withdrawal-right handling in Checkout,
  and VAT/OSS registration — before they're anything more than a draft.
- **Multi-region and partner marketplace listings** were deliberately not
  pursued (see Phase 6 note below) — not gaps, just scope that was never
  asked for.

**Local development.** Every app that needs Clerk reads
`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` from its own
`.env.local` (copy each app's `.env.example`); `apps/console`, `apps/api`,
`apps/sentinel`, `apps/cspm` and `apps/gateway` additionally need
`DATABASE_URL` pointed at a real Postgres instance (see
[`packages/database/README.md`](packages/database/README.md) for
migrations). `apps/console` needs `STRIPE_SECRET_KEY` to create real
Checkout Sessions, and `apps/api` needs `STRIPE_WEBHOOK_SECRET` to verify
and process subscription events — both apps also need `STRIPE_PRICE_ID_PRO` and
`STRIPE_PRICE_ID_PRO_YEARLY` set to the "NEXORA Pro" product's monthly
($29) and yearly ($290) Price ids, created in the Stripe dashboard first. Until configured, every
protected route across every app renders a clear "Setup required" or "not
reachable" message instead of crashing — this is what a fresh local
checkout looks like; production has all of this already set.

## Getting started

Requires Node.js 20+ (CI and the Docker image use 22). On a fresh Mac, `brew bundle`
installs the whole toolchain and `npm run doctor` checks it — see
[`docs/development.md`](docs/development.md).

```bash
npm install
npm run dev
```

The website app starts at `http://localhost:3000`. To run every app at once
(website `3000`, account `3001`, console `3002`, status `3003`, api `3004`,
docs `3005`, developers `3006`, sentinel `3007`, cspm `3008`, gateway
`3009`), start each with `npm run dev --workspace apps/<name>` in its own
terminal, or use this project's `.claude/launch.json` configurations.

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
| `npm run test:api`     | Runs the API contract tests (Newman)       |
| `npm run doctor`       | Checks your machine has the required tools |

## License

See [LICENSE](LICENSE).
