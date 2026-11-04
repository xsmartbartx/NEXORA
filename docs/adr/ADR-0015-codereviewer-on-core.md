# ADR-0015: Bringing CodeReviewer onto Core

Status: accepted, 2026-11-03. Phases 1 to 3 shipped (see the update below).

## Context

CodeReviewer (`xsmartbartx/CodeReviewer`) reviews GitHub pull requests with Claude. It is a
Next.js app plus a pg-boss worker with its own Postgres 17, hosted on the shared VM as compose
project `codereviewer` (`/home/opc/codereviewer`) and served at `codereviewer.onenexora.com` through
the edge Caddy (PR #117). Like Vigilo and NeuraWall before ADR-0014, it is fully independent:

|         | CodeReviewer today                                                                                    |
| ------- | ----------------------------------------------------------------------------------------------------- |
| Sign-in | GitHub App user OAuth and its own session cookie; no passwords                                        |
| Tenancy | One `account` per GitHub App installation (a GitHub user or organisation)                             |
| Access  | A user sees the installations GitHub lists for them (`GET /user/installations`, refreshed at sign-in) |
| Billing | Same Stripe account as Core; own Pro ($39/month) and Team ($149/month) prices, webhook and checkout   |
| Quotas  | Reviews per calendar month, enforced by the worker from its own database                              |

The difference from Vigilo is the tenant. Vigilo's tenant is a person, which maps onto a Clerk
user. CodeReviewer's tenant is a GitHub installation, and GitHub decides who may see it. A Clerk
organisation and a GitHub installation are unrelated identities: being an admin of a Clerk
organisation proves nothing about any GitHub account. Mapping one to the other safely is the core
of this ADR.

## Decision

Follow ADR-0014: integrate in phases, one PR per repository per phase, each phase off until its
env variables are set, never rewriting authentication or billing data in one step.

### Phase 1: listed and operated

No data, authentication or billing changes.

- **Registry:** `prod_codereviewer` (category `developer`, pillar `ai`, lifecycle `beta`), with
  capabilities and plan references. It gets a real product page and sitemap entry on
  onenexora.com, unlike Vigilo and NeuraWall whose pages redirect, and appears on the AI pillar.
- **Website:** a CodeReviewer section on `/pricing` (Free 20 reviews, Pro 250, Team 1,000 a month),
  and the company page names it among the independently built products.
- **Status and uptime:** a status component and an uptime probe for
  `https://codereviewer.onenexora.com/api/health` (it answers 503 when its database is down),
  plus the Control Center endpoint and repository lists.
- **Deploy:** `deploy.sh codereviewer` takes the host lock, runs `git pull --ff-only` in
  `/home/opc/codereviewer`, `docker compose build migrate` (web, worker and migrate share one
  image) and `docker compose up -d`, which runs migrations before web and worker restart. The
  host guard allows the new project.
- **Backups:** `backup-all.sh` adds `codereviewer-postgres.dump` (it includes the pg-boss queue
  schema). `restore-rehearsal.sh` restores it on `postgres:17-alpine`, and the monthly
  `restore-drill.sh` restores it too, checking that `accounts`, `repositories` and `reviews` exist.
  `docker-cleanup.sh` is host-wide and needs no change.
- **Rollback:** revert the PR; nothing else depends on it.

### Phase 2: Core billing, as Vigilo phase 4

Core owns the subscription of an organisation, CodeReviewer keeps enforcing quotas from its own
database, and Core tells CodeReviewer the plan.

- **Catalogue:** product `codereviewer` with `free` (20 reviews), `pro` (250, $39) and a new tier
  id `team` (1,000, $149), metered key `codereviewer.review`. Prices reuse the live prices
  CodeReviewer already sells, through optional `STRIPE_PRICE_ID_CODEREVIEWER_PRO` and
  `_TEAM`. They are monthly only: with no `_YEARLY` id, Console shows no yearly option. Unset
  means no checkout for that plan and nothing changes. It is externally enforced: Core does not
  offer to suspend it and shows no usage meter.
- **Sync:** after Core's webhook records a `codereviewer` item it sends
  `POST https://codereviewer.onenexora.com/api/internal/org-plan` with body
  `{clerk_org_id, plan_id, as_of}`, where `as_of` is the Stripe event's `created` time. The
  headers are `X-Nexora-Timestamp` and `X-Nexora-Signature = HMAC-SHA256(secret,
"<ts>.<body>")`, as for Vigilo. The secret is its own `CODEREVIEWER_SYNC_SECRET`, not Vigilo's,
  so each sync can be rotated or turned off alone. Core's plan rule applies: `active` and
  `trialing` are paid, everything else and a deleted subscription are `free`. Each attempt leaves
  an audit event `billing.codereviewer_sync.completed`. A failure is re-thrown so Stripe
  redelivers.
- **CodeReviewer's endpoint:** answers 404 until `NEXORA_SYNC_SECRET` is set. It accepts at most
  1 KB, checks the HMAC over the exact bytes in constant time and a 5-minute replay window, and
  gives the same 401 for every failure. It stores the plan per organisation, ignoring an `as_of`
  older than the stored one (Stripe does not guarantee order), and stores it even before any
  installation is linked, so a later link applies it at once.
- **Effective plan:** the higher of the account's own subscription plan (unchanged rule) and its
  linked organisation's plan. Org plans count only while `NEXORA_SYNC_SECRET` is set.
- **The two webhooks ignore each other's events.** Core already ignores subscriptions without
  `orgId` metadata, and CodeReviewer's own checkout tags only `accountId`. CodeReviewer's webhook
  will ignore subscriptions that carry `orgId`, and, without `accountId`, any whose price is not
  one of its own. Tests cover both directions.
- **CodeReviewer's own checkout stays for accounts not linked to an organisation**, like Vigilo's
  personal accounts and a standalone NeuraWall. A linked account's billing page says it is billed
  through the NEXORA organisation and links to Console. An own subscription that already exists
  keeps running until cancelled. The higher plan applies, and the page asks the admin to cancel
  one of the two.

#### Linking an installation to an organisation

A link lets a Clerk organisation pay for an installation (phase 2) and lets its members see that
installation's reviews (phase 3). Linking account A to organisation O needs both halves in one
browser flow:

1. **GitHub proof, in CodeReviewer.** A fresh GitHub OAuth identifies user U. U must be A itself
   (an installation on a personal account) or the user who installed the app on A, recorded from
   the `sender` of the `installation.created` webhook, and U must still have access to the
   installation. A repository collaborator who can merely see the installation cannot link it.
   The `installation_id` in a setup redirect is never trusted on its own.
2. **Organisation consent, in Console.** An `org:admin` of O confirms on `/link/codereviewer`.
3. **Binding.** CodeReviewer creates a single-use link request (random nonce, stored hashed, 10
   minutes) for A and U, sets the nonce in an httpOnly cookie, and sends the nonce to Console.
   Console redirects to a fixed CodeReviewer URL with a grant `{org_id, org_name, account_id,
nonce, plan_id, as_of, exp}`, signed `HMAC(CODEREVIEWER_SYNC_SECRET, "link.<ts>.<body>")`.
   CodeReviewer accepts it only if the signature, expiry, account and nonce all match the
   request that this browser's cookie names. A grant replayed in another browser, or made for
   another account, fails.

The flow is: CodeReviewer billing page, then GitHub OAuth, then Console confirmation, then
CodeReviewer, where the account is linked and the grant's plan applies. Unlinking is open to U
under the same rule, and from phase 3 to an admin of O. Deleting the organisation in Core cancels
its subscriptions, which pushes `free`.

An installation that predates phase 2 has no recorded installer. Its owner can still link a
personal-account installation. An organisation installation must be reinstalled first. Production
has no installations yet, because the GitHub App is not configured.

**Rollback:** unset `CODEREVIEWER_SYNC_SECRET` in Core, which stops syncs and links, or the price
ids, which stops checkout. Unsetting `NEXORA_SYNC_SECRET` in CodeReviewer returns every account to
its own plan. The migration only adds columns and a table.

### Phase 3: Clerk sign-in next to GitHub

- CodeReviewer uses `@clerk/nextjs` on the same production instance as Vigilo
  (`clerk.onenexora.com`), signing in through account.onenexora.com. It is off until the Clerk
  keys are set.
- `users.github_id` becomes nullable and `users.clerk_user_id` is added. A Clerk session maps to
  a CodeReviewer user, created on first visit.
- **Authorisation:** a Clerk viewer sees exactly the accounts linked to their active organisation,
  in any role. Linking, unlinking and billing are for `org:admin` only. Without an active
  organisation they get the organisation switcher and no accounts. A GitHub viewer is unchanged
  and sees the installations GitHub lists for them. The two models never mix in one request, and
  every access check goes through one function, which the tests exercise for both.
- Linking from a Clerk session skips the Console hop, because the session already carries
  `org_id` and `org_role`. The GitHub proof is unchanged. An "Install on GitHub" button for an
  organisation passes a signed state to `installations/new`, so that install ends in the same
  link flow.
- GitHub sign-in stays until users of linked accounts have moved, then `GITHUB_SIGNIN=off` hides
  it. The GitHub OAuth credentials remain, because linking needs the GitHub proof.
- **Rollback:** unset the Clerk keys and CodeReviewer is GitHub-only, as today.

### Not part of this

- Moving review quotas into Core Entitlements. CodeReviewer keeps enforcing them.
- Migrating existing CodeReviewer subscriptions into Core.
- Usage events to Core (ADR-0014 phase 3 pattern) and yearly prices.

## Consequences

CodeReviewer becomes a listed, monitored and backed-up NEXORA product with no behaviour change
(phase 1). Organisations can then buy it in Console, while CodeReviewer keeps its own billing for
unlinked accounts (phase 2), and finally sign in with their NEXORA account (phase 3). Linking an
installation always needs proof from both GitHub and Clerk, so neither identity alone can attach
someone else's code reviews to an organisation. Every phase changes production data or
authentication in another repository and is reviewed, tested and rolled back on its own.

Manual steps, by phase:

- **Phase 1:** none. (#117, the edge route, is live on the host as an uncommitted change; once it
  merges, reset those two files in `/opt/nexora` to `HEAD` before the next `git pull`.)
- **Phase 2:** generate one secret and set it as `CODEREVIEWER_SYNC_SECRET` in Core and
  `NEXORA_SYNC_SECRET` in CodeReviewer. Set the two price ids in Core. If Core uses a dedicated
  Customer Portal configuration (`STRIPE_PORTAL_CONFIGURATION_ID`), add CodeReviewer's products
  to it. The account's default portal is shared and stays unchanged.
- **Phase 3:** add the Clerk keys to CodeReviewer. If Clerk restricts redirect origins, allow
  `codereviewer.onenexora.com` there.

## Update: phases 1 to 3 shipped (2026-11-03)

- **Phase 1** (#118, CodeReviewer#10) is deployed: product page, pricing, sitemap, status page,
  uptime probe and Control Center entries are live; `deploy.sh codereviewer` is the deploy path, and
  the nightly backup, restore rehearsal and monthly restore drill include CodeReviewer's database.
- **Phase 2** (#119, CodeReviewer#11) is deployed and off until the secret and price ids are set
  (`docs/codereviewer-link.md`). Two changes from the plan above: a link grant's plan only fills in
  an organisation Core has not pushed yet (Core's pushes, ordered by event time, always win), and
  with `NEXORA_SYNC_SECRET` set CodeReviewer enforces plans even without its own Stripe keys.
- **Phase 3** (CodeReviewer#12) runs Clerk server-side only, in CodeReviewer's `proxy.ts`, with
  this app's origin as the only authorized party. A GitHub session takes precedence over a NEXORA
  one, so the GitHub sign-in that linking needs never mixes the two access models. Linking from a
  Clerk session without the Console hop, and the install-time link through the setup URL, were
  not built: linking always goes through phase 2's flow, which already proves both sides.
- Not yet: the Control Center shows the Vigilo plan sync only; CodeReviewer's sync is audited
  (`billing.codereviewer_sync.completed`) but has no tile.
