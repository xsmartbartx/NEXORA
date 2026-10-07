# NEXORA brand check (2026-10-07)

NEXORA keeps its name and look. This is a conflict check, a contrast check, a voice guide and a leftover sweep.

## 1. Name check: needs a lawyer before more money goes into the name
Screening only, not legal clearance. Search results are secondary sources; verify each on the registry itself.

| check | result |
| --- | --- |
| onenexora.com | yours (Squarespace registrar, transfer-locked) |
| nexora.com, getnexora.com | held by others (GoDaddy) |
| nexora.ai (expires 2028-09-22), nexora.io (2027-08-05) | held by others |
| github.com/nexora, instagram.com/nexora | exist (taken) |
| Web search "Nexora security platform" | **another product named Nexora**: a non-human-identity security platform, listed on Capterra (https://www.capterra.co.uk/software/1085702/Nexora). Same category as NEXORA: security software |
| Trademarks | **Nexora, India, application 6962521, class 9, filed 2025-04-17** (https://www.registerkaro.in/trademark-search/nexora-6962521). NEXOR, US, Nexor Limited, registered 1999 (https://gleanmark.com/trademark/uspto-75126772), similar mark |
| USPTO, EUIPO, Canada, WIPO | **to run**, in classes 9, 42 and 36 if payments are involved |
| App Store, Google Play | **to run** if a mobile app is planned |

Risk: customers and search engines may confuse NEXORA with the other Nexora product. Recommended before the next marketing spend: a trademark search by a lawyer, and a decision on whether the public name stays "NEXORA" or becomes a distinctive form. Not a reason to rename today.

## 2. Palette (packages/ui/src/tokens.css, checked with replica-design's contrast.py)
- Dark theme (the shipped one): 14 of 16 pairs pass AA. **Fail 1:** white text on the destructive button, 3.87:1. Fix: dark text on that red, 4.89:1 (PR opened).
- **Fail 2 (not fixed, needs a design call):** `--border`/`--input` against the background is 1.38:1; form fields drawn with only that border fall short of the 3:1 WCAG asks for field boundaries.
- Light theme is defined but no app turns it on. If it ever ships it fails 4 pairs: secondary button text 3.09, success text 3.88 and warning text 2.63 on white, and the same border.

## 3. Voice: plain, exact, calm
- **Plain, not casual.** Short words; no "unleash" or "supercharge".
- **Exact, not exhaustive.** Say the number and the limit: "20 scans a month on Free".
- **Calm, not cold.** Security is stressful; errors say what happened and what to do.

| do | don't |
| --- | --- |
| "Gateway logs the outcome and response time. Not your prompts." | "Enterprise-grade privacy." |
| "$29 a month. No markup on provider cost." | "Contact sales." |
| "No API keys yet. Create one to call the API." | "No data." |
| "This finding fired because the log rate was 4x your baseline." | "Anomaly detected." |
| "Sign in to continue." | "Authentication required." |

Proposed rewrites (not applied; copy changes go through the website PR flow): hero "One account, one console, one API. Security and AI tools small teams can actually read."; empty keys "No API keys yet. Create one to call the API."; setup screen "This app isn't connected to its database yet. Nothing is wrong with your account."; beta badge "Beta: works on data you give it, not live connections".

## 4. Logo
Existing `packages/ui/src/logo-mark.tsx` is kept. No brief needed unless the name changes.

## 5. Sweep (sweep.py, replica/brand.json)
Avoid-list: OpenRouter, Cloudflare AI Gateway, Helicone, Portkey, LiteLLM, Datadog, Wiz, Lacework, Vanta, Prisma Cloud, Snyk, Sentry. 121 hits, **all Sentry**: NEXORA's own error tracker (observability package, staff-only Control Center, env examples). No competitor name appears in customer-facing copy. Clean for launch.
