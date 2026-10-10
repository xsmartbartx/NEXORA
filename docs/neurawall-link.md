# Linking NeuraWall to a NEXORA organisation

NeuraWall (the AI-assisted firewall) is hosted by its customers, so Core cannot call it. A linked
installation instead calls Core, with an organisation API key, for two things. This file is the
Core side; the NeuraWall side is `docs/nexora.md` in the NeuraWall repository.

| Contract | Endpoint                         | Direction                         |
| -------- | -------------------------------- | --------------------------------- |
| C-ENT    | `GET /v1/entitlements/neurawall` | NeuraWall pulls its plan (hourly) |
| C-EVENT  | `POST /v1/events`                | NeuraWall pushes usage counts     |

Both are documented in `apps/api/public/openapi.json` and on docs.onenexora.com (API Reference).

## Access

An API key created in Console with **Allow linking a NeuraWall installation** carries the
`neurawall:link` scope (`api_keys.scopes`). A key without it gets `403 insufficient_scope`. The
organisation is the key's; no request can name another one.

## What Core stores and returns

- **Plan:** the `subscriptions` row for product `neurawall` (catalog `PLAN_CATALOG.neurawall`: `free` is
  Community on the wire, then `pro`, `business`, `enterprise`). Same rule as Core's own plans: only `active` and `trialing` count; anything else,
  an unknown plan id, or a `product_suspensions` row means `community`. No row means `community`.
- **Events:** one `audit_events` row per event (`action` = the event type, `actor_id` =
  `apikey:<key id>`, `external_id` = the sender's `event_id`, `metadata` = `{data, source_ts}`), so
  they show in Console's Usage feed. A unique index on `(org_id, external_id)` makes retries
  idempotent. The event contract is closed (`packages/telemetry/src/neurawall-events.ts`): a fixed
  list of types and fields, no addresses or personal data.

## Still to do by hand (not code)

1. **Run migration 0008** (`audit_events.external_id` and its unique index; additive, nullable).
2. **Clerk JWT template `neurawall-sso`** (Clerk dashboard; the handoff route is
   `apps/account/src/app/sso/neurawall/route.ts`). For NeuraWall's just-in-time users the template
   must add: `email` (the primary email), `email_verified` (**a boolean `true`**, not a string),
   `org_id` (the active organisation) and `aud` = `neurawall`, with a short lifetime. NeuraWall
   refuses to create or link users otherwise.
3. **NeuraWall plans in Core billing** (built; off until configured). Set
   `STRIPE_PRICE_ID_NEURAWALL_PRO`, `_BUSINESS`, `_ENTERPRISE` (and `_YEARLY`) in the production env to
   the **same live price ids NeuraWall already uses** (in NeuraWall's `.env`:
   `NEURAWALL_BILLING__PRICE_<PLAN>_MONTH` / `_YEAR`). Then add NeuraWall's products to **Core's Customer
   Portal configuration** in the Stripe dashboard, or plan changes and cancelling will not work from
   Console. Until the ids are set no plan is purchasable and every organisation reads as `community`.
4. **Create the link key** in Console for the organisation and set it as
   `NEURAWALL_NEXORA__API_KEY` on the NeuraWall installation, with
   `NEURAWALL_AUTH__SSO_REQUIRED_ORG_ID` set to the same organisation.
