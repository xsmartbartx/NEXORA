# Skills: End, Czujka, Agent Team, CTO Analyst

Claude Code skills and the small tools that keep them honest. None touches production or reads
secrets. End and Czujka are tier T0 (read only); Agent Team is T1 (proposes changes in pull requests, never
deploys or merges); CTO Analyst only researches. Nothing is scheduled and nothing costs until you run it.

| skill    | when                    | produces                                                                                                       |
| -------- | ----------------------- | -------------------------------------------------------------------------------------------------------------- |
| `/end`   | at the end of a session | a summary under 300 words and at most 3 improvements, each with metric, baseline, target and how to measure it |
| `czujka` | weekly, or on request   | proposals for repeated work, each with source, frequency, estimated saving and risk                            |

## Install (a person runs it; it only adds symlinks under `~/.claude/skills`)

```bash
bash ops/skills/install.sh
```

The skills live here, not in `.claude/skills`, because `.claude/` is git-ignored in this repository.

## What keeps them honest

- `validate-report.mjs end|czujka <file>` checks the shape: summary length, at most three improvements,
  every required field present and non-empty, or an explicit "No improvement proposed" / "too thin".
  The skills tell the model to run it on its own report before showing it.
- `czujka-metadata.mjs` is Czujka's only data source: git history reduced to counts, subject
  prefixes (digits folded, secret-shaped values redacted) and the **names** of changed files. It never
  reads a file's content or a diff; a test commits a secret into a file and checks it never appears.
- Czujka is told to look at existing mechanisms first (Control Center, Notification Hub, Cloud
  Worker, CI) and to say so instead of proposing a duplicate.

```bash
node ops/skills/czujka-metadata.mjs --since "30 days ago" --min 3
```

## Agent Team and CTO Analyst: what code enforces

`validate-report.mjs plan|review|cto` checks:

- **plan:** at most 4 workers; budget above 0 and at most 10 USD, estimates adding up to it; every task
  has a prompt, scope and acceptance command; scopes do not overlap unless `dependsOn` orders them;
  **no scope reaches secrets (any `.env*`, key files), CI workflows, the deployment, edge or Terraform
  folders, `ops/guardians` or the private notes**; the validator cannot write, runs the tests and has a
  prompt unlike any worker's.
- **review:** `PASS`/`FAIL`, at least one command with its result, the diff that was reviewed,
  "Wrote files: no", a finding for every FAIL, and no PASS beside a failing command.
- **cto:** all five criteria with an integer score 1 to 5, evidence and an https source, a recommendation
  that is adopt, trial, hold or reject, and an ADR draft with status Proposed, context, decision and consequences.

The check cannot make the validator truly independent or stop a model from ignoring its own plan:
the plan is checked before workers start, and the Guardians hook is what blocks the actions themselves.

## Limits

The format is checked by code; whether a proposal is a good one is still a judgement a person makes.
Savings are estimates the skill must justify, not measurements. Czujka sees only the repository's git
history in v1: pull request, CI and overdue-review metadata come through `gh` calls the skill may
make, not through the collector. A weekly scheduled report would go through the Cloud Worker, and
because it needs a model, it must pass the monthly budget gate first; that is not wired yet.
