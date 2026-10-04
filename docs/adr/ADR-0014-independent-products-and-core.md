# ADR-0014: Bringing Vigilo and NeuraWall closer to Core

Status: accepted (phase 1 shipped), 2026-10-03

## Context

Vigilo and NeuraWall were built outside this monorepo and are hosted on the
same VM. Surveying them showed they are further along than "not on Core"
suggests, but differ in the ways that matter:

|         | Vigilo (Python + Next.js)                                                | NeuraWall (Python + React)                                            |
| ------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| Sign-in | Clerk, **same instance** (`clerk.onenexora.com`), JWT verified via JWKS  | Its own: argon2 passwords, JWT sessions, RBAC with four-eyes approval |
| Billing | Same Stripe account; own plans (Free, Pro) and own `subscriptions` table | Own billing module                                                    |
| Tenancy | An `Account` per Clerk **user**                                          | Own operator accounts                                                 |
| Data    | Own Postgres                                                             | Own Postgres                                                          |

Core is organisation-scoped (Clerk organisations, `subscriptions` per
`(orgId, product)`, entitlements, audit events).

## Decision

Integrate in phases, never rewriting a product's authentication or billing
data in one step:

1. **Shipped:** Console `/billing` shows Vigilo's plan, read from Vigilo's own
   `GET /v1/me` with a Clerk token for the `vigilo-api` template (sent over
   HTTPS only). Vigilo remains the source of truth for its subscription, and no
   existing billing data is migrated; however `/v1/me` provisions a free Vigilo
   account for a first-time caller, so loading `/billing` can create that one
   row. NeuraWall is linked only.
   Core's Stripe webhook already ignores prices that are not in the Core
   catalogue, so Vigilo's events cannot disturb Core subscriptions.
2. **Next:** make Vigilo accept the Clerk organisation (`org_id` claim) and
   scope accounts, targets and keys by organisation, with a migration that
   maps each existing user account to a personal organisation.
3. **Then:** Vigilo emits usage events to Core (an authenticated ingest
   endpoint) so Console's Usage and Activity show scans.
4. **Then:** move Vigilo's plan into the Core catalogue and have Core own the
   subscription, retiring Vigilo's webhook.
5. **NeuraWall:** put Clerk SSO in front of the operator console only after
   its RBAC and four-eyes rules are mapped to Clerk roles. It is a security
   product; its authentication is not replaced without that mapping and tests.

## Consequences

Console and Vigilo share one sign-in and Console shows Vigilo's plan; NeuraWall
keeps its own authentication and is only linked. Existing Vigilo billing data is
not migrated (a free account may be provisioned on first read, see phase 1).
Phases 2 to 5 each touch production data or
authentication in another repository and need their own review and rollback
plan.
