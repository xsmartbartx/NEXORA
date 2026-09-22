# NEXORA

> Build What's Next. — Technology · AI · Security

NEXORA is a technology platform. Its products are intelligent software, AI
systems and secure digital products that share one account, one console, one
API surface and one operational backbone.

This repository (`nexora-platform`) holds the website, console, account and
docs applications, plus the shared packages they all consume. Product
repositories (Sentinel, CSPM, Gateway) live separately and consume this
platform as tenants — see the architecture document for the full model.

## Read first

The platform architecture, principles, phased build plan and contracts are
defined in
[`docs/NEXORA-PLATFORM-ARCHITECTURE.md`](docs/NEXORA-PLATFORM-ARCHITECTURE.md).
Read it before making a structural change.

## Repository layout

```
apps/
  website/          onenexora.com — marketing site
packages/
  ui/                design tokens and shared UI primitives
  config/            shared TypeScript / lint / format configuration
infrastructure/       DNS, edge, deployment (provisioned per environment)
docs/                 architecture, ADRs and supporting documents
```

See §9.2 of the architecture document for the full target layout as more
apps and packages are added.

## Build status

| Phase | Scope | Status |
| --- | --- | --- |
| 0 | Foundations: monorepo, CI, design tokens, base UI package | ✅ Done |
| 1 | Product Registry and marketing website | 🚧 In progress |
| 2 | Identity, Account and Console | ⬜ Not started |
| 3 | API, Docs and Developer surface | ⬜ Not started |
| 4 | Sentinel and CSPM as platform tenants | ⬜ Not started |
| 5 | Gateway, Billing and Labs | ⬜ Not started |
| 6 | Marketplace and scale | ⬜ Not started |

## Getting started

Requires Node.js 20+.

```bash
npm install
npm run dev
```

The website app starts at `http://localhost:3000`.

## Scripts

Run from the repository root; each fans out to every workspace that defines
the script.

| Command | Does |
| --- | --- |
| `npm run dev` | Starts the website app in development mode |
| `npm run build` | Production build of every app and package |
| `npm run lint` | ESLint across every workspace |
| `npm run typecheck` | `tsc --noEmit` across every workspace |
| `npm run format` | Formats the repository with Prettier |
| `npm run format:check` | Checks formatting without writing |

## License

See [LICENSE](LICENSE).
