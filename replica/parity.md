# NEXORA parity (2026-10-06)

Self-audit: "original" = target state in features.csv, "clone" = what is verified live or tested. Layout diff skipped (same product).

**Feature score: 81.8 / 100.** 18 features counted, must-haves 8 of 10 done.
**Verdict: not shippable by the skill's rule** (2 must-haves open). No open S1 or S2 bugs (B-001 fixed and live).

| area | score |
| --- | --- |
| legal | 0.0 |
| ops | 66.7 |
| product | 81.8 |
| billing | 83.3 |
| identity | 92.9 |
| website, console, api, docs | 100 |

## Missing, in build order
1. [must] Legal pages reviewed by a lawyer: needs a legal entity, jurisdiction, VAT/OSS, EU withdrawal handling. Not something code can close.
2. [must] Stripe checkout + webhook sync: partial. Signature rejection is tested live and sync is unit-tested, but a real checkout was not re-run, and the account has no test mode, so CI can't cover it.
3. [should] Live-connected Sentinel/CSPM connectors: both scan user-provided data only. The biggest product gap.
4. [should] Status page: manually maintained.
5. [could] NeuraWall SSO: refused until a matching NeuraWall user exists.

## Behaviour notes
- F01 happy path is ~9 clicks to first paid state (target 7).
- Many "yes" rows were verified by hand on 2026-10-01 and are not automated; signed-in flows have no e2e coverage.

## Top five next
1. Lawyer review + legal entity. 2. Stripe test-mode account so billing can be tested in CI. 3. Create the NeuraWall user so SSO works. 4. Signed-in e2e tests (needs a test Clerk user). 5. First real Sentinel/CSPM connector.
