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
infrastructure/       DNS, edge, deployment (provisioned per environment)
docs/                 architecture, ADRs and supporting documents
```

See §9.2 of the architecture document for the full target layout as more
apps and packages are added. Note: §9.1 describes `nexora-core-api` and each
product as their own repositories long-term; they live in this monorepo for
now, alongside everything else built so far — splitting repos apart is a
later, separate decision.

## Build status

| Phase | Scope                                                     | Status        |
| ----- | --------------------------------------------------------- | ------------- |
| 0     | Foundations: monorepo, CI, design tokens, base UI package | ✅ Done       |
| 1     | Product Registry and marketing website                    | ✅ Done       |
| 2     | Identity, Account and Console                             | ✅ Scaffolded |
| 3     | API, Docs and Developer surface                           | ✅ Scaffolded |
| 4     | Sentinel and CSPM as platform tenants                     | ✅ Scaffolded |
| 5     | Gateway, Billing and Labs                                 | ✅ Scaffolded |
| 6     | Marketplace and scale                                     | ✅ Scaffolded |

"Scaffolded" means the code is real, builds/typechecks/lints clean, and
degrades gracefully instead of crashing — but ships with placeholder Clerk,
Postgres and Stripe credentials, so sign-in and checkout aren't usable until
real ones are set. **Everything that doesn't need Clerk was verified
against real infrastructure, not just typechecked:**

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

## Before this goes live

**Identity, database and billing.** Every app that needs Clerk reads
`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` from its own
`.env.local` (copy each app's `.env.example`); `apps/console`, `apps/api`,
`apps/sentinel`, `apps/cspm` and `apps/gateway` additionally need
`DATABASE_URL` pointed at a real Postgres instance (see
[`packages/database/README.md`](packages/database/README.md) for
migrations). `apps/console` needs `STRIPE_SECRET_KEY` to create real
Checkout Sessions, and `apps/api` needs `STRIPE_WEBHOOK_SECRET` to verify
and process subscription events — both apps also need `STRIPE_PRICE_ID_PRO`
set to a real Price id, and all three require a real Stripe account with
that price created in its dashboard first. Until configured, every
protected route across every app renders a clear "Setup required" or "not
reachable" message instead of crashing.

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

## License

See [LICENSE](LICENSE).
