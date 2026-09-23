# ADR-0011 — Billing provider selection: Stripe over Paddle

|         |                                                                                                                                               |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Status  | Accepted                                                                                                                                      |
| Phase   | 5 (payments), revisited going into credential setup                                                                                           |
| Extends | [`NEXORA-PLATFORM-ARCHITECTURE.md`](../NEXORA-PLATFORM-ARCHITECTURE.md) §10 (stack table), §16 (this closes the ADR-0011 slot in the backlog) |

## Context

§10's stack table named Paddle as the default payment provider, with Stripe
listed as the explicit fallback ("Replaceable by: Stripe + tax provider").
Phase 5 built the full billing integration against that default: webhook
signature verification in Paddle's `ts=...;h1=...` format, checkout via
`@paddle/paddle-js`'s client-side overlay, and a `subscriptions` table with
`paddle_subscription_id`/`paddle_customer_id` columns.

Going into real credential setup (connecting a real payment account for
the first time), the provider was reconsidered and Stripe was chosen
instead — before any real Paddle account existed, so there was no
migration-of-live-data cost to the switch, only a rewrite of code that had
never processed a real payment.

## Decision

Use Stripe. `packages/billing` was rewritten in full:

- **Webhook verification** now uses the `stripe` SDK's own
  `Stripe.webhooks.constructEvent` (a static method — it needs only the
  webhook signing secret, not a full API client) instead of a hand-rolled
  HMAC implementation. This is a genuine improvement independent of the
  provider choice: Stripe's own verification handles the documented
  `t=...,v1=...` header format and replay-tolerance window correctly by
  construction, rather than reimplementing it.
- **Checkout** is now a Stripe-hosted Checkout Session created server-side
  (`packages/billing/src/checkout.ts`) and reached by redirect — no
  client-side SDK, no client-exposed token at all. This is simpler than
  Paddle's client-side overlay flow (`@paddle/paddle-js`, removed from
  `apps/console`'s dependencies entirely) and keeps the secret key
  server-only.
- **Org association** travels via `subscription_data.metadata.orgId` at
  Checkout Session creation, which Stripe copies onto the resulting
  Subscription object — the webhook reads `subscription.metadata.orgId`
  directly, the same role Paddle's `custom_data.orgId` played.
- The `subscriptions` table's `paddle_subscription_id`/`paddle_customer_id`
  columns were renamed to `stripe_subscription_id`/`stripe_customer_id`
  (migration `0002_rename_paddle_to_stripe.sql`) rather than dropped and
  recreated — verified against real Postgres: `ALTER TABLE ... RENAME
COLUMN` preserves any existing rows, and there were none to lose yet.
- The upsert-by-`orgId` design (a resubscribe after cancellation updates
  the same row, keyed by org rather than by the payment provider's
  subscription id, which changes across a cancel/resubscribe) carried over
  unchanged — it was never Paddle-specific.

## Consequences

- **Stripe is not a merchant of record; Paddle was.** Paddle's rationale in
  §10 was specifically "reduces tax and compliance burden" — it collects
  and remits sales tax/VAT on NEXORA's behalf as the seller of record.
  Stripe (without an add-on like Stripe Tax, which is a separate setup and
  cost) does not do this: NEXORA becomes responsible for its own sales
  tax/VAT registration and remittance in whatever jurisdictions it sells
  into. This is a real, non-technical obligation the business takes on by
  this choice, not something the code can paper over.
- **Simpler checkout, no client secret exposure.** Stripe's hosted
  Checkout Session eliminated the need for any client-side payment SDK or
  a publicly-exposed client token (Paddle's `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`
  had no Stripe equivalent to replace — there's nothing public to hand the
  browser).
- **Credentials needed to go live** are now `STRIPE_SECRET_KEY` (Console,
  server-only — creates Checkout Sessions), `STRIPE_WEBHOOK_SECRET` (API,
  server-only — verifies incoming events) and `STRIPE_PRICE_ID_PRO`
  (both — maps an incoming price id back to a plan). None of these are
  client-exposed, unlike Paddle's setup which needed one public token.
- **Verified the same way Phase 5 verified Paddle**, using Stripe's own
  `generateTestHeaderString` rather than a hand-rolled HMAC test signature:
  valid/tampered/wrong-secret/malformed/missing signature handling, plan
  mapping, upsert-by-org semantics (including the resubscribe-with-a-new-
  subscription-id case), and the orphan-row guard (an event with no
  `orgId` in metadata throws rather than writing an unassociated row) —
  all against real Postgres.
