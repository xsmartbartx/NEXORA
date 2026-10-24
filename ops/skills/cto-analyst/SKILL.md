---
name: cto-analyst
description: Monthly evaluation of one tool, model or repository against a fixed card (cost, security, license, maintenance, fit) with evidence and links, ending in a draft ADR for a pull request. Read-only research. Use for the monthly review or when asked whether to adopt a tool.
allowed-tools: Bash(node ops/skills/validate-report.mjs:*), Bash(gh repo view:*), Bash(gh api repos:*), Bash(npm view:*), WebSearch, WebFetch
---

# CTO Analyst: evaluate one candidate, draft an ADR

One candidate per run. Research from public sources; never paste or fetch anything from the
repository's secrets, and never put NEXORA data into a search. `allowed-tools` pre-approves the
commands above and does not restrict the session; the Guardians hook (`ops/guardians`) is the hard boundary.

## The card

```
## Candidate
<name, version, what it would replace or add>
## Scores
| Criterion | Score (1-5) | Evidence | Source |
| Cost | 4 | free tier covers our volume | https://... |
| Security | 3 | ... | https://... |
| License | 5 | ... | https://... |
| Maintenance | 4 | ... | https://... |
| Fit | 3 | ... | https://... |
## Recommendation
trial. One sentence on why and on what would change it.
## ADR draft
Status: Proposed
Context: ...
Decision: ...
Consequences: ...
```

Score only what a source supports; where there is no evidence, say so and score low. Cost includes
what it adds to the monthly 10 USD agent budget. Security covers known advisories, how it handles
secrets and what access it needs. Prefer the project's existing mechanisms: say what already covers it.

Check the card with `node ops/skills/validate-report.mjs cto -` before showing it. Every criterion needs an
integer score, evidence and an https link; the recommendation starts with adopt, trial, hold or
reject. The ADR goes into a pull request as a draft; adopting anything is a human decision.
