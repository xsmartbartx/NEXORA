# Billing CodeReviewer through Core

CodeReviewer reviews GitHub pull requests and is hosted on the NEXORA host, so Core can call it.
Phase 2 of ADR-0015 lets an organisation buy CodeReviewer in Console. This file is the Core side;
the CodeReviewer side is `docs/nexora-integration.md` in the CodeReviewer repository.

| Contract     | Endpoint                                                                | Direction                             |
| ------------ | ----------------------------------------------------------------------- | ------------------------------------- |
| Plan update  | `POST https://codereviewer.onenexora.com/api/internal/org-plan`         | Core's Stripe webhook pushes the plan |
| Link consent | Console `/link/codereviewer` → CodeReviewer `/api/nexora/link/complete` | Browser redirect with a signed grant  |

## Plan updates

After the Stripe webhook records a `codereviewer` subscription item, it sends
`{"clerk_org_id", "plan_id", "as_of"}` with `X-Nexora-Timestamp` and
`X-Nexora-Signature` = hex `HMAC-SHA256(CODEREVIEWER_SYNC_SECRET, "<timestamp>.<body>")`.
`plan_id` is already resolved (`free`, `pro` or `team`; only `active` and `trialing` are paid, a
deleted subscription is `free`). `as_of` is the Stripe event's `created` time, so CodeReviewer
ignores an update that arrives after a newer one. Each attempt leaves an audit event
`billing.codereviewer_sync.completed`; a failure makes the webhook answer non-2xx and Stripe
redelivers.

## Linking a GitHub account to an organisation

CodeReviewer's tenants are GitHub accounts (installations of its GitHub App), so a plan bought here
applies to the accounts linked to the organisation. A link needs proof from both sides in one
browser:

1. In CodeReviewer, a fresh GitHub sign-in by the account itself or by whoever installed the app
   on it. CodeReviewer creates a single-use request and sends the browser to
   `/link/codereviewer?account=<id>&login=<login>&nonce=<nonce>`.
2. Here, an organisation admin confirms. Console redirects to CodeReviewer with a grant
   `{org_id, org_name, account_id, nonce, plan_id}`, signed with the same secret under the prefix
   `link.` (so it can never pass as a plan update) and valid for 10 minutes.
3. CodeReviewer applies it only together with the cookie nonce and signed-in user of the request
   that browser started.

## Still to do by hand (not code)

1. **Secret.** Generate one value (`openssl rand -hex 32`) and set it as `CODEREVIEWER_SYNC_SECRET`
   here and as `NEXORA_SYNC_SECRET` in CodeReviewer's environment. Then redeploy `api` and
   `console` here and CodeReviewer there.
2. **Prices.** Set `STRIPE_PRICE_ID_CODEREVIEWER_PRO` and `_TEAM` to the live monthly prices
   CodeReviewer already sells (its own `STRIPE_PRICE_PRO` and `STRIPE_PRICE_TEAM`). Until they
   are set there is no Console checkout and every organisation reads as Free.
3. **Customer Portal.** If Core uses its own portal configuration
   (`STRIPE_PORTAL_CONFIGURATION_ID`), add the CodeReviewer products to it so plan changes work
   from Console. Do not change the account's default portal configuration, which other products
   share.

Rollback: unset `CODEREVIEWER_SYNC_SECRET` (no plan updates, no links) or the price ids (no
checkout).
