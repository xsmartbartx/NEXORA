# NEXORA launch plan (2026-10-07)

Web only: no app-store listing. Nothing on the live site is changed by this file. It builds on replica/fixes.md (angle A) and replica/brand.md.

## 0. Gate: do these before any public launch push
1. **Legal.** Terms, Privacy and Security pages are an AI draft, there is no legal entity, and paid subscriptions are already live in Stripe. A lawyer needs to review before you drive traffic (entity, VAT/OSS, EU withdrawal rights).
2. **Name.** A lawyer's trademark search (see brand.md: another security product called Nexora, and Nexora and NEXOR marks).
3. **PR #43 (Gateway cost limits) merged and deployed.** Without it a free key can spend your upstream key without a ceiling, and the flat prices below have no cost floor.
4. **Signed-in checks.** Signed-in flows have no automated tests; do one manual run of sign-up, scan, key creation and checkout before the post goes up.

## 1. Pricing review
Read 2026-10-07 from each vendor's public page; prices change, so recheck before quoting.

| vendor | plans (as read) | URL |
| --- | --- | --- |
| OpenRouter | Free 50 req/day; Standard 5.5% platform fee; Business 8%; BYOK free to $25,000 of list-price use a month, then 5% | https://openrouter.ai/pricing |
| Helicone | Hobby free (10,000 requests); Pro $79/mo; Team $799/mo; usage-based beyond 10K | https://www.helicone.ai/pricing |
| Portkey | Developer free (10k logs); Production $49/mo (100k); $9 per extra 100k | https://portkey.ai/pricing |
| Sentry | Developer $0 (1 user); Team $26/mo; Business $80/mo | https://sentry.io/pricing/ |
| NEXORA Gateway | Free $0 (100 req); Starter $19 (1,500); Pro $59 (12,000); Business $199 (60,000); Scale $599 (300,000); annual 20% off | https://onenexora.com/pricing |
| NEXORA Sentinel | $0 (20 scans) / $9 (150) / $29 (1,500) / $79 (7,500) / $249 (40,000) | same |
| NEXORA CSPM | $0 (10) / $19 (75) / $49 (750) / $149 (3,500) / $399 (20,000) | same |
| NEXORA Vigilo | Free (3 scans) / Pro $29 ($290 yearly) | same |

What the research said about price (all thin, one source): fees and unclear prices came up in 9 of 17 comments; complexity for small teams in 4.

**Do not claim "no markup on provider cost".** Gateway does not pass provider cost through: it relays with NEXORA's own key and customers pay a flat quota, so there is no markup to disclaim. The accurate claim, once PR #43 ships: *a flat monthly price, model usage included, no per-token bill and no credit-purchase fee.* Do not compare per-request prices to Portkey or Helicone: they route calls on your own provider key, NEXORA includes the inference, so the products are not like for like.

Findings:
- **Too many tiers.** 5 tiers x 3 products plus Vigilo is 16 plans; the research complaint is complexity for small teams. Propose showing Free, Pro and Business by default with Starter and Scale under "more plans". The plan catalog stays as it is; only the page changes.
- **Cancellation** already works: Console opens Stripe's Customer Portal for org admins. Check in the Stripe dashboard that renewal-reminder emails are on (I can't see that setting).
- **Margin risk until PR #43:** see gate 3.
- Annual is 20% off monthly (about 2.4 months free), in line with the usual.

## 2. Landing page copy (proposal; hero text goes through a website PR)
1. **Hero:** "Security and AI tools small teams can read in an afternoon." Under it: "One account, flat published prices, and a Gateway that keeps your outcome and latency, not your prompts." Button: "Start free". Image: a real Console screenshot.
2. **Problem:** "Security and AI-gateway tools tend to be built for teams with a security staff. Pricing hides behind a sales call or a per-token fee, and setup takes a week." (paraphrase of research themes; no reviewer quotes)
3. **How it works:** 1 Create an organisation. 2 Paste a log sample or config, or call the API with a key. 3 See findings and usage in Console within seconds.
4. **Features, fixes first:** flat prices with every tier published; what we store, stated plainly (Gateway: outcome and response time; Sentinel and CSPM: nothing written to the database); per-end-user usage and a per-request log (planned, not built: do not list it until it ships); then parity items.
5. **Pricing:** the Free / Pro / Business table above.
6. **FAQ:** "Do you store my prompts?" (answer from the privacy page). "What happens when I hit my limit?" "How do I cancel?" (Console, Billing, manage). "Does Sentinel connect to my cloud?" (No: it analyses what you paste; live connectors are not built).
7. **Final call:** "Start free. Upgrade when you need more."
Proof section: **leave empty.** No testimonials, user counts or logos exist yet; add real beta users with permission.

## 3. Launch plan
- **Before:** a waitlist or beta list on the site; Sentry and uptime are already live. Talk by hand to the first 10 users.
- **Where the unhappy users are** (from the research, HN only): threads about gateway fees and observability costs, for example https://news.ycombinator.com/item?id=47924254 and https://news.ycombinator.com/item?id=45866237. Reddit, G2 and Capterra were not read.
- **Post:** a Show HN that leads with the fix, not the platform: "Flat-price AI gateway and log-anomaly scanner for small teams; here is exactly what we store." Be ready for the first comment to ask about the Nexora name conflict and about the legal pages.
- **Product Hunt:** after the gate items, with a real screenshot set.
- **Measure:** sign-ups to first scan to first paid org (F01, about 9 clicks; aim for 7).
