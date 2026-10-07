# NEXORA production-readiness audit (2026-10-07)

Read-only. Nothing was deployed, and no DNS or Stripe setting was changed. NEXORA is already live; this is the preflight gate run against it.

## Gate results
| check | result |
| --- | --- |
| Unit tests | 26 files, 194 tests pass |
| E2E smoke against production | 29/29 pass |
| Format, lint, typecheck | clean (CI also runs the production build on every PR; the build on main finished) |
| Brand sweep (third-party names) | clean, exit 0. "Sentry" is NEXORA's own error tracker, so it was removed from the avoid list |
| Parity | 81.8 / 100; must-haves 8 of 10 |
| Open S1/S2 bugs | none (B-001 headers fixed and live; Gateway cost limits live) |

**Verdict: technically healthy, not ready for a push of public traffic.** The two open must-haves block it by the skill's rule.

## Blockers (not code)
1. **Legal pages are an AI draft** and no legal entity exists, yet paid subscriptions are live. Needs a lawyer, an entity, VAT/OSS and EU withdrawal-right handling.
2. **Stripe checkout and webhook sync** (must, partial): signature checks tested live; a real checkout was not re-run, and the account has no test mode. Do one real purchase and refund it.
3. **Name conflict risk**: another product named Nexora in security software, plus Nexora and NEXOR trademark filings (brand.md). Needs a trademark search.

## Production services
| item | result |
| --- | --- |
| Hosting | one OCI VM behind Caddy; 53% disk, no container unhealthy or restarting |
| HTTPS | Let's Encrypt cert valid to 2026-12-25; http redirects to https (308) |
| Database | its own production Postgres; migrations run by the deploy (db-migrate); backups below |
| Backups | nightly 03:00 UTC to /opt/backups/archives and off-site to OCI bucket `nexora-backups` (logged OK on 2026-10-06 and 2026-10-07) |
| **Restore drill** | `restore-drill.sh` exists but **no run is recorded on the host**: backups are untested. Run it once and note the date |
| Error tracking | Sentry DSN and org set in the environment |
| Uptime | GitHub Actions uptime check every 15 minutes, failure emails the repository owner |
| Audit retention | cron installed 2026-10-06; log present on the host |
| Env vars | all Stripe price ids (5 tiers x 3 products, monthly and yearly), Clerk, Postgres, Sentry and sync secrets are present (names only checked, values not read) |
| Stripe | live mode per README; a stale disabled duplicate webhook endpoint at api.onenexora.com/v1/webhooks/stripe can be deleted |
| Analytics | none found in the code, so no cookie banner is needed beyond the essential cookies the privacy page describes |

## DNS and email (read from the production host: this shell cannot resolve DNS)
| record | result |
| --- | --- |
| Nameservers | Squarespace (nsd1-4.squarespacedns.com) |
| A onenexora.com, www | both point at the production VM |
| MX | smtp.google.com (Google Workspace) |
| SPF | `v=spf1 include:_spf.google.com ~all` present |
| DKIM | `google._domainkey` present |
| **DMARC** | **missing** (`_dmarc.onenexora.com` empty) |
| CAA | none (optional) |

Add this TXT record at Squarespace (you do it; I don't change DNS): name `_dmarc`, value `v=DMARC1; p=none; rua=mailto:security@onenexora.com`. Tighten to `quarantine` once the reports are clean.
`hello@` and `security@onenexora.com` are advertised on the site and in security.txt, so Workspace must have those mailboxes or aliases; send a test message to each.

## Smaller findings
- **www does not redirect**: https://www.onenexora.com returns 200 with the same content as the apex, so there are two canonical hosts. Add a redirect to the apex in the Caddyfile (S4).
- **No social card**: `/opengraph-image` is 404, there is no `og:image`, and `twitter:card` is `summary`. A Show HN or Product Hunt link will unfurl bare (S4).
- **Favicon** is served; page title is "NEXORA — Build. Secure. Operate."
- **Content-Security-Policy** still not set (needs testing with Clerk and Stripe).
- **Signed-in flows** have no automated tests; do a manual run before launch.

## First week after any launch push
Watch: Sentry unresolved errors (Control Center tile), the uptime workflow, Gateway 4xx rates (the new limits), Stripe webhook failures, disk (build cache), and the first two nightly backups.

## Note on the planning files
This session's `replica/` notes were auto-committed (as a commit named ".") onto feature branches and pushed to the public repository. They hold no secrets, but they do hold your pricing analysis and gap list. Decide whether `replica/` should live in the repo.
