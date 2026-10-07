# NEXORA recon map

Subject: NEXORA itself (own product, own repo, own live site). This is a self-audit, not a clone:
the "original" and the "clone" are the same platform, so the map doubles as a gap analysis.
Date: 2026-10-04. Platform: web (Next.js monorepo, Clerk, Postgres/Drizzle, Stripe, Docker on OCI).

## 1. Scope
- App: NEXORA platform (onenexora.com + 9 subdomain apps + Vigilo + NeuraWall as external tenants).
- Slice: the core loop = visitor -> sign-up -> org -> console -> product use -> usage -> billing -> API key.
- Audience: security/AI teams that want one account, console, API and billing across several products.

## 2. Sources
| source | url / path | status |
| --- | --- | --- |
| README + architecture doc | README.md, docs/NEXORA-PLATFORM-ARCHITECTURE.md (1159 lines) | read (README); arch doc to read in /replica-architect |
| Marketing site | https://onenexora.com | fetched (home) |
| Plan catalog | packages/billing/src/plans.ts | read |
| Pentest scope | docs/security/pentest-scope.md | read |
| Route tree | apps/*/src/app | listed |
| ChatGPT share 1 (6ac2bc97...) "Analiza repozytorium NEXORA" | chatgpt.com/share/... | **title only** - page is JS-rendered, content not retrievable |
| ChatGPT share 2 (6ac2bcb2...) "Setup infrastruktury firmy" | chatgpt.com/share/... | **title only**; the third link you pasted is a duplicate of this one |

To use the chats: paste their text or export them into replica/sources/.

## 3. Screen inventory
| ID | screen | route | purpose | states to record |
| --- | --- | --- | --- | --- |
| S01 | Home | onenexora.com/ | positioning, 5 products, pillars | mobile |
| S02 | Platform + pillar | /platform, /platform/[pillar] | AI/Security/Cloud pillars | - |
| S03 | Products + product page | /products, /products/[slug] | catalog, per-product detail | beta badge |
| S04 | Marketplace | /marketplace | listings (kind taxonomy) | empty partner |
| S05 | Solutions | /solutions, /solutions/[slug] | use-case pages | - |
| S06 | Pricing | /pricing | 5 tiers x product, annual -20% | toggle monthly/yearly |
| S07 | Bundles | /bundles | multi-product bundle | - |
| S08 | Labs + experiment | /labs, /labs/log-anomaly-baseline | experiments | - |
| S09 | Company, Changelog | /company, /changelog | trust | - |
| S10 | Legal x3, security arch | /legal/*, /security/architecture | terms/privacy/security (AI draft) | draft banner |
| S11 | Sign in / up | account /sign-in, /sign-up | Clerk + Google OAuth | error, setup-required |
| S12 | Account home, profile, orgs | account /, /user-profile, /organizations | identity, org mgmt | no org |
| S13 | Select organisation | console /select-organization | org picker | none, many |
| S14 | Console overview, products | console /, /products | org control plane | free vs paid |
| S15 | Usage, Analytics | console /usage, /analytics | usage feed, per-day buckets | empty, over limit |
| S16 | API keys | console /api-keys | create/revoke nx_live_ keys | empty, shown-once secret |
| S17 | Billing, bundle | console /billing, /billing/bundle | Stripe checkout, portal | free, pro, past_due |
| S18 | Security, Organisation | console /security, /organisation | session + org settings | - |
| S19 | Staff admin | console /admin, /admin/[orgId], control-center, deployments, keys, logs, webhooks | operator tools | 404 for non-staff |
| S20 | Sentinel (marketing + app) | sentinel /, /app | log anomaly scan | empty, scan result, limit hit |
| S21 | CSPM (marketing + app) | cspm /, /app | config scan | same |
| S22 | Gateway (marketing + app) | gateway /, /app, POST /v1/chat | AI call proxy + audit | blocked, upstream error |
| S23 | Docs | docs /quickstart, /concepts, /api-reference, /sdks, /limits, /operations, /products, /security, /changelog | developer docs | - |
| S24 | Developers, Status | developers., status. | landing, manual component status | incident |
| S25 | Vigilo, NeuraWall | external apps (own repos) | URL scanner, AI firewall | SSO refused (no matching user) |
| S26 | Setup-required | every app /setup-required | graceful missing-env page | - |

## 4. Flows
- F01 Visitor to paying org: S01 -> S06 -> S11 -> S12 -> S13 -> S14 -> S17 (Stripe Checkout) -> S14. Edge: no org, webhook delay, failed payment.
- F02 First scan: S14 -> S20 -> run scan -> S15 shows event seconds later. Edge: free limit (20 scans) blocks.
- F03 API key lifecycle: S16 create (secret shown once) -> call api.onenexora.com -> X-RateLimit-* headers -> revoke -> 401.
- F04 Gateway call: API key -> POST /v1/chat -> entitlement check -> upstream -> audit event. Edge: upstream error, over limit.
- F05 Plan sync: Stripe webhook -> subscriptions upsert (orgId, product) -> entitlements; Vigilo plan pushed via HMAC /v1/internal/org-plan.
- F06 NeuraWall SSO: account /sso/neurawall -> fragment token (aud=neurawall) -> NeuraWall. Currently refused: no matching NeuraWall user.
- F07 Staff ops: S19 control center, deployments, suspensions, cost tracking.
Happy-path clicks F01 to first paid state: ~9. Number to beat: 7.

## 5. Components
Header/product switcher/account menu (packages/shell), design tokens + primitives (packages/ui), plan card, pricing toggle, usage table/day chart, key table + one-time secret modal, setup-required panel, status pill, beta badge, legal draft banner. Variants/states to be extracted in /replica-design.

## 6. Data model (from packages/database, high confidence)
- api_keys (org-scoped, hashed, revocable)
- audit_events (usage telemetry + audit, org-scoped, day-bucketed queries)
- subscriptions (one row per orgId + product; tiers free/starter/pro/business/scale; Stripe ids)
- product_suspensions, ops_checklist_completions, ops_costs (staff/ops)
- Identity (users, orgs, roles) lives in Clerk, not Postgres. Registry/marketplace/labs are code-defined, not DB.

## 7. Findings (gap analysis)
1. Stripe is live-only (no test mode) so billing E2E tests need care. Pricing doc says Pro $29/$290 while plans.ts has 5 tiers per product: README env section is stale.
2. Legal pages are AI-drafted; no legal entity, VAT/OSS, EU withdrawal handling. Blocks serious launch.
3. NeuraWall SSO unusable until a matching user exists.
4. Sentinel/CSPM run on data the user provides, not live connectors. Honest but the main product gap.
5. Single OCI VM, single region, one operator: no HA, no on-call.
6. Disk/build-cache pressure was an incident (PR #35); stale duplicate Stripe webhook.
7. 5 repos' worth of products (Vigilo, NeuraWall) outside this monorepo: parity must be tracked across them.

## 8. Cannot be cloned / out of scope
Clerk/Stripe/OCI themselves, customer data, the user base, third-party AI provider behind Gateway.

## 9. Size
Screens 26 groups (~70 routes), flows 7, entities 6, hard parts: multi-tenant isolation, Stripe<->entitlement sync across products, SSRF-safe scanners (Vigilo/Gateway). For a self-audit the remaining work is size M.

## 10. External analysis: ChatGPT share "Analiza repozytorium NEXORA" (written about 2026-10-02)
Read 2026-10-07 in the built-in browser (the page needs JavaScript; WebFetch only returns the title). The other two links in the original request, "Setup infrastruktury firmy", were not re-read. The chat is an AI analysis, so each claim was checked against the repo, GitHub and the live site before it was recorded here.

| claim in the chat | verified 2026-10-07 |
| --- | --- |
| `main` is unprotected, no required checks | **Stale.** Protected; required checks are "Lint, typecheck and build" and "Docker build (website)"; enforcement `non_admins`, so an admin can bypass. Only 2 of ~18 checks are required (not the other 9 Docker builds, not CodeQL) |
| CI builds only the website image | **Stale.** The Docker job is a matrix over every app |
| no GitHub releases | **Stale.** v0.1.0 exists (tag and release, 2026-10-03). Still one release, version 0.1.0 |
| docs say no product is public / `/products` empty | **Stale.** The quickstart no longer says that; `/products` lists 5 beta products |
| README calls prices placeholders | **Stale.** The README states the prices are the live Stripe prices |
| no `/opengraph-image`, no product structured data | OG image **was true, fixed in PR #44**; product pages already had SoftwareApplication JSON-LD |
| no restore test | **Was true, done** (drill passed 3 times, once from the off-site copy) |
| Vigilo and NeuraWall are not Core-native | **Still true for the public copy.** Both product pages say "Independently built and hosted, not yet on Core identity/entitlements" |
| rate limiter fails open to in-memory when Redis is down | **True** (`packages/api-kit/src/rate-limit.ts`): per-instance limits only while Redis is down |
| single region, backups in the same region | **Partly changed.** Single region still; backups are now also copied to an OCI bucket (`nexora-backups`) |
| legal pages are drafts, no entity | **Still true** |
| no SDK or CLI, no OpenAPI | Still true (docs list `/sdks` and `/api-reference`; not re-audited) |
| container hardening, SBOM, image signing | Mixed: images run as a non-root user; **no `cap_drop`, `read_only`, `no-new-privileges` or memory limits** in the compose files; no SBOM or signing |

### New finding from this check: restart policy
`docker inspect` on the host: 19 containers have restart policy `no`, 11 `unless-stopped`; no systemd unit and no `@reboot` cron brings them back. NEXORA's apps, Postgres and Redis are in the `no` group, memory limit 0 on all. After a VM reboot or a crash, NEXORA stays down until someone logs in, while Caddy (restart `unless-stopped`) answers 502. The uptime workflow would alert; nothing would recover. **Fixed 2026-10-07:** PR #49 added `restart: unless-stopped` to the 17 long-running services in `docker-compose.prod.yml` (not to the one-shot `db-migrate`), and the policy was applied live with `docker update --restart unless-stopped` to the 17 running containers without restarting them. Memory limits are still unset.
