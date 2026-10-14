# CostSec v1

Two small, deterministic pieces. No model is involved, so a run costs $0.

## Configuration audit (`policy.mjs`, `run.mjs`, workflow `costsec.yml`)

Weekly (Monday) and on demand. Reads the repository's settings through the GitHub API, applies
the rules in `policy.mjs` and keeps **one** issue up to date ("CostSec: configuration audit").
The issue is closed when only low or info findings remain. The job's only write is that issue.

Rules: default branch protected, required checks, no force push or deletion, `enforce_admins`
(known, accepted until Guardians G3), secret scanning, push protection, Dependabot security
updates, default workflow permissions, every workflow declares `permissions:`, none uses
`pull_request_target`, no open high or critical Dependabot or code scanning alerts.

**Token.** With only the workflow's `GITHUB_TOKEN`, protection details, security settings and
alerts cannot be read; they are reported as `UNVERIFIED` (info), never as passing. To verify them,
create a fine-grained, read-only personal access token for this repository (Administration: read,
Dependabot alerts: read, Code scanning alerts: read, Metadata: read) and store it as the repository
secret `COSTSEC_TOKEN`. That is a secret and stays yours to create.

## Agent spending limit (`budget.mjs`, `budget.json`)

Monthly limit **10 USD**, warning at **80 %**, stop at **100 %**, plus a kill switch
(`"killSwitch": true`). `canSpend(budget, spent, estimate)` is the gate every model-using job calls
before it starts; an invalid `budget.json` fails closed (treated as killed). Nothing spends tokens
yet. The Cloud Worker (stage 4) will record each run's cost in `job_runs` and call this gate.

Not in v1: the host audit (`nexora-audit`, needs the restricted host user of Guardians G2) and
cost sources outside the repository (OCI, Stripe).
