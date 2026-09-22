# System overview

Brief pointer into [`NEXORA-PLATFORM-ARCHITECTURE.md`](NEXORA-PLATFORM-ARCHITECTURE.md).
Full detail lives there — this page exists so `/docs/system-overview.md`
resolves per Appendix B, and to orient a reader who has not read the full
document yet.

## Layers (§3.3)

`Edge → Experience → Product → Core → Data`, with `Trust` cross-cutting every
layer and `Knowledge` reading from `Core`. A layer depends downward only. A
product may call Core; Core never calls a product.

## Surfaces (§7.1, §8)

| Host                                             | Layer      | This repo                             |
| ------------------------------------------------ | ---------- | ------------------------------------- |
| `onenexora.com`                                  | Experience | `apps/website`                        |
| `console.onenexora.com`                          | Experience | `apps/console` (Phase 2)              |
| `account.onenexora.com`                          | Experience | `apps/account` (Phase 2)              |
| `docs.onenexora.com`                             | Knowledge  | `apps/docs` (Phase 3)                 |
| `status.onenexora.com`                           | Knowledge  | `apps/status` (Phase 2)               |
| `api.onenexora.com`                              | Core       | `nexora-core-api` (separate repo)     |
| `sentinel` / `cspm` / `gateway` `.onenexora.com` | Product    | separate repos, consume this platform |

## Core contracts (§4.2)

Every product-to-platform interaction is one of four contracts: `C-AUTH`
(identity), `C-ENT` (entitlements), `C-EVENT` (usage/audit/health),
`C-META` (registry metadata out to public surfaces). Nothing else is
permitted between a product and Core.

## Current state

Phase 0 (this repository's monorepo skeleton, CI, design tokens, base UI
package) is done. Phase 1 (Product Registry + full marketing site IA) is in
progress — see the root [README](../README.md) build-status table.
