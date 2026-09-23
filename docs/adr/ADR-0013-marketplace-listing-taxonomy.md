# ADR-0013 — Marketplace listing taxonomy as a sibling entity to Product

| | |
|---|---|
| Status | Accepted |
| Phase | 6 |
| Extends | [`NEXORA-PLATFORM-ARCHITECTURE.md`](../NEXORA-PLATFORM-ARCHITECTURE.md) §5.2, §14.3 Phase 6 |

## Context

Phase 6's deliverable is a marketplace taxonomy covering apps, APIs, agents,
models, integrations and tools, with the exit criterion: "a listing type
other than 'product' can be added without a schema rewrite."

`Product` (§5.2) already models one of these kinds — "app" — in detail: a
subdomain, a lifecycle state machine, a Tenant Contract to satisfy, health
and docs sources. The other five kinds don't carry any of that. An API
surface, a third-party integration, or eventually an agent or model doesn't
have a subdomain, doesn't graduate through `concept → alpha → beta →
production`, and isn't a tenant of Core in the way a Product is.

Two designs were available:

1. **Generalise `Product` into a `Listing` supertype**, with app-specific
   fields (subdomain, lifecycle, Tenant Contract state) made optional and a
   `kind` discriminant added.
2. **Add a new, separate `MarketplaceListing` entity** alongside `Product`,
   covering only the non-app kinds, and render the marketplace page as
   "Products, plus MarketplaceListings" rather than one unified table.

## Decision

Option 2. `MarketplaceListing` (`packages/registry/src/types.ts`) is a new
entity with its own kind enum (`api | agent | model | integration | tool`)
and its own query layer
(`getMarketplaceListings`/`getMarketplaceListingsByKind`/
`getMarketplaceListingBySlug`), separate from `Product`'s. The marketplace
page composes both: Products rendered under "Apps" via the existing
`getPublicProducts()`, and `MarketplaceListing`s rendered per remaining
kind.

`ProductIntegration` (already defined in §5.2 but unseeded until now) is a
distinct, narrower concept: a declared functional connection *between two
Products*, not a listing in its own right. It gets its own data file and
query functions (`getProductIntegrations`), surfaced on the product detail
page.

## Consequences

- **The exit criterion holds by construction.** A new kind — the eventual
  first `model` or `agent` listing — is one object appended to
  `packages/registry/src/data/marketplace-listings.ts`. No field is added
  to `Product`, no migration, no page rewrite: the marketplace page already
  iterates every kind in `marketplaceKindLabels`.
- **No duplicated data, no drift (R-7).** Sentinel, CSPM and Gateway are
  never re-entered as marketplace records; the "Apps" section reads the
  Product registry directly, same as `/products`.
- **A generic `Listing` supertype was rejected** because Product's
  app-specific fields (lifecycle, Tenant Contract, health source) would
  either become optional noise on every non-app listing, or force
  non-app listings through a lifecycle state machine that doesn't apply
  to them (an API reference doesn't have a "beta" the way a product does).
  Keeping them separate costs one extra entity and query file; the
  alternative costs meaning.
- **Empty kinds ship as an honest empty state, not fabricated entries.**
  `agent`, `model` and `tool` have zero listings today — the marketplace
  page renders "Nothing listed here yet" per kind rather than inventing a
  placeholder, consistent with how Labs and Billing already handle
  not-yet-real data (Phase 5).
- **`ProductIntegration` ships unseeded for the same reason.** No NEXORA
  product currently calls or reads from another; the type, data file and
  query layer exist so the first real one is a data change, not new code.
