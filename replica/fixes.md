# NEXORA fixes and angle (from competitor research)

**Sample: 17 Hacker News comments (2020-2026) from one source, no star ratings.** Collected through HN's official Algolia API; every quote is verbatim and linked in `replica/reviews.csv`. They concern the space NEXORA is in (LLM gateways such as OpenRouter, Cloudflare AI Gateway and Helicone; Sentry and Datadog observability; small-team cloud security), not NEXORA itself. NEXORA has no public reviews. Under 30 reviews from one source supports a direction, not a ranking: **every theme below is thin.** Not collected: G2, Capterra, Trustpilot, Reddit, app stores (terms forbid scraping, and a human has to read them).

## 1. What they hate
1. **Fees and unclear pricing** (9 comments). "Just be aware OpenRouter charges a 5.5% fee, I didn't know until recently." (https://news.ycombinator.com/item?id=47924254) · "Not seeing any pricing info on the models[1] page." (https://news.ycombinator.com/item?id=47793121)
2. **Too complex for small teams** (4). "Many folks need something simpler, that just works." (https://news.ycombinator.com/item?id=45866237) · "...find the tooling very inaccessible. Particularly in small teams" (https://news.ycombinator.com/item?id=22689725)
3. **Trust in a third party** (3). "I don't feel comfortable either proxying my llm calls through a 3rd party unless the 3rd party is a llm gateway like litellm or arch or storing my prompts in a SaaS." (https://news.ycombinator.com/item?id=42442608) · "Cloudflare AI Gateway is reporting inaccurate/wrong price for flagship models" (https://news.ycombinator.com/item?id=47806253)
4. **Self-hosting is heavy** (4). "it's made of 6 or 7 different services, each with a pretty large footprint." (https://news.ycombinator.com/item?id=37765355)
5. **Alert noise** (1, very thin). "Most of the alerts were false positives 90%+ of the time and we eventually ignored them" (https://news.ycombinator.com/item?id=33536893)

## 2. What is missing
- Per-end-user usage attribution through a header, and a way to inspect completion traffic (https://news.ycombinator.com/item?id=47853948).
- Spend monitoring per API key (https://news.ycombinator.com/item?id=38609106).
- Completions in both OpenAI and Anthropic styles (https://news.ycombinator.com/item?id=47793121).

## 3. What is unsolved
Security tooling that a team too small for a security staff can adopt without a sales call: "Even if you're too small to have an incident response team, if you work on the cloud, you need to prevent these common security issues." (https://news.ycombinator.com/item?id=22691464). Thin (2 comments, both 2020).

## Fix plan (evidence x cost)
| # | change | size | skill | evidence |
| --- | --- | --- | --- | --- |
| 1 | Say "no markup on provider cost" and show full prices up front on /pricing and the Gateway page (check Gateway really adds none first) | S | launch | theme 1, 9 comments |
| 2 | State prominently what Gateway and Sentinel store: per the privacy page, Gateway logs only outcome and response time, Sentinel/CSPM content is not written to the database. Make it a trust page, not a clause | S | launch | theme 3, 3 comments |
| 3 | Per-end-user attribution (a request header) and a per-request log view in Console Usage | M | build/backend | missing list, 3 comments |
| 4 | Show why each Sentinel/CSPM finding fired and a confidence level, to fight noise | S | build | theme 5, 1 comment (thin) |
| 5 | Gateway accepts Anthropic-style requests besides the current messages shape | M | backend | 1 comment (thin) |
| 6 | Simple self-hosted option (one container) | L | architect | theme 4, 4 comments; defer, NEXORA is hosted-only by design |

## Angle (recommend A)
- **A. Readable security and AI-cost layer for small teams.** For small teams who find security and AI-gateway tools expensive, opaque and built for enterprises, NEXORA is one account with flat published prices, no hidden markup and no prompt storage. Evidence: fees (9) and small-team complexity (4), one source, thin.
- **B. Private by default.** For teams uncomfortable proxying prompts through a third party, Gateway keeps only outcome and latency. Evidence: trust, 3 comments, thin.
- **C. Self-hostable.** Evidence 4 comments, but contradicts the hosted-only product. Not recommended.
Do not name competitors in the product name, ads or store listing.
