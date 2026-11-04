# ADR-0016: Bringing Prism onto the platform

Status: accepted, 2026-11-04. Phase 1 in progress.

## Context

Prism (`xsmartbartx/Prism`) is a self-hosted data platform: Excel and CSV files become typed,
versioned datasets (Parquet), then charts, dashboards and share links. It is a FastAPI app with a
React UI in one container, on PostgreSQL or SQLite, released as `ghcr.io/xsmartbartx/prism`. Like
Vigilo, NeuraWall and CodeReviewer before their ADRs, it is fully independent:

|         | Prism today                                                                                 |
| ------- | ------------------------------------------------------------------------------------------- |
| Sign-in | Its own: scrypt passwords, server-side sessions, invite and reset links, personal API keys  |
| Tenancy | Workspaces inside one instance; roles viewer, explorer, author, steward, admin, auditor     |
| Billing | None online: plans (Community, Pro, Business) unlocked by offline Ed25519 license keys      |
| Data    | Its own Postgres (metadata) and a data volume (dataset versions, uploads)                   |
| Hosting | Customers run it themselves (`deploy/compose.yml` with Caddy); NEXORA runs one instance too |

Prism is closest to NeuraWall: customers host it, so Core can never call an installation, and its
plan enforcement already lives inside the product.

## Decision

Follow ADR-0014 and ADR-0015: phases, one PR per repository per phase, each phase off until it is
configured, never rewriting authentication or billing data in one step.

### Phase 1: listed, hosted and operated

No data, authentication or billing changes in Core.

- **Registry:** `prod_prism` (category `cloud`, pillar `cloud`, lifecycle `beta`), capabilities and
  plan references. It gets a real product page and sitemap entry on onenexora.com.
- **Website:** a Prism section on `/pricing` (Community free; Pro $49 and Business $199 a month,
  yearly ten months, per instance), and the company page names it among the independently built
  products. Paid plans go to sales, because they are license keys, not a Core checkout.
- **Hosting:** compose project `prism` in `/opt/prism` (`deploy/nexora/compose.yml` in the Prism
  repository): the released image and PostgreSQL 16, no host ports, read-only root filesystem.
  The edge Caddy joins `prism_default` and serves `prism.onenexora.com` behind the Cloudflare
  origin lock. It does not import `security_headers`: Prism sets its own headers and CSP, and its
  opt-in `/embed/` pages must be frameable.
- **Status and uptime:** a status component and an uptime probe for
  `https://prism.onenexora.com/readyz` (503 when its database or storage is unavailable), plus the
  Control Center endpoint and repository lists.
- **Deploy:** `deploy.sh prism` takes the host lock, pulls `/opt/prism`, pulls the image named by
  `PRISM_VERSION` and runs `up -d`; the app migrates on start-up. Nothing is built on the host.
  The host guard allows it, with approval because it runs migrations.
- **Backups:** `backup-all.sh` adds `prism-postgres.dump` and `prism-data.tar.gz` (the dataset
  versions are files, not rows). `restore-rehearsal.sh` restores the dump on `postgres:16-alpine`
  and lists the data archive; the monthly `restore-drill.sh` restores it and checks `users`,
  `datasets`, `dataset_versions` and `audit_events`. Archives from before this change are tolerated.
- **First start:** the instance is claimed before its DNS record exists
  (`prism create-admin --random-password`, then `prism reset-link`), so nobody can complete
  Prism's first-run setup in between, and no password is ever chosen for someone or sent.
- **Rollback:** revert the PR and remove the route; `docker compose down` keeps the volumes.

### Phase 2: linked installations, as NeuraWall

An organisation buys Prism in Console; a linked installation pulls its plan from Core instead of a
license key, and reports usage.

- **Catalogue:** product `prism` with `community`, `pro` and `business`, reusing Stripe prices
  through optional `STRIPE_PRICE_ID_PRISM_PRO`, `_BUSINESS` (and `_YEARLY`). Unset means no
  checkout and nothing changes. Externally enforced: no suspension, no usage meter.
- **Contracts:** `GET /v1/entitlements/prism` and `POST /v1/events` with an organisation API key
  carrying a new `prism:link` scope ("Allow linking a Prism installation" in Console). A closed
  event contract (`prism.dataset.loaded`, `prism.chart.created`, `prism.share.created`), counts
  only, no dataset contents or personal data.
- **Prism side:** with `PRISM_NEXORA__API_KEY` set, the instance pulls the plan hourly and the
  plan from Core wins over a license key; without it nothing changes.
- **Rollback:** unset the price ids (no checkout) or the key on the installation (license keys
  apply again).

### Phase 3: Sign in with NEXORA

Optional Clerk sign-in for an installation linked to an organisation, mapped onto Prism roles
(members become viewers; admins are granted inside Prism), local sign-in kept. Not started.

## Consequences

Prism becomes a listed, monitored and backed-up NEXORA product hosted at `prism.onenexora.com`,
with no change to Core's data, sign-in or billing (phase 1). Self-hosted customers keep offline
license keys; phase 2 adds Core billing for organisations without forcing it on anyone.

Manual steps, phase 1:

- Clone `/opt/prism`, create `/opt/prism/.env` (mode 600) from `deploy/nexora/env.example`, start
  the stack once, claim the instance, and `docker network connect prism_default edge-caddy-1`
  (the edge stack's compose file names the network for its next recreation).
- Add a proxied `A` record `prism` → the VM's public IP in Cloudflare, then `deploy.sh edge`.
- Keep `/opt/prism/.env` in the password manager with the other environment files.
