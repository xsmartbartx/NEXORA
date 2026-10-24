---
name: agent-team
description: Runs a multi-agent change in the NEXORA repo as planner, workers in separate worktrees, integrator and an independent validator. Tier T1: it proposes changes in pull requests and never deploys, merges or touches production credentials. Use when a task splits cleanly into independent parts, or when asked for an agent team.
allowed-tools: Bash(node ops/skills/validate-report.mjs:*), Bash(git worktree:*), Bash(git status:*), Bash(git diff:*), Bash(git log:*)
---

# Agent Team: planner, workers, integrator, independent validator

Use it only when the work splits into parts that do not touch the same files. One agent is cheaper
and safer for everything else. `allowed-tools` pre-approves commands; it does not restrict the
session. The hard boundaries are the Guardians hook (`ops/guardians`) and the plan check below.

## 1. Plan (you, the planner)

Write the plan as JSON and check it before any worker starts:

`node ops/skills/validate-report.mjs plan - <<'PLAN'` ... `PLAN`

```json
{
  "goal": "one sentence",
  "budgetUsd": 4,
  "tasks": [
    {
      "id": "api-route",
      "prompt": "what this worker does",
      "scope": ["apps/api/src/app/v1/x"],
      "acceptance": "npx vitest run apps/api",
      "estimatedCostUsd": 1.2,
      "dependsOn": []
    }
  ],
  "integrator": "who merges the worktrees and how conflicts are settled",
  "validator": {
    "prompt": "a different prompt: find what is wrong",
    "canWrite": false,
    "runs": ["npm test", "npm run typecheck"]
  }
}
```

The check enforces: at most 4 workers, a budget above 0 and at most 10 USD with the estimates adding up
to it, every task with a prompt, a scope and an acceptance command, scopes that do not overlap unless
`dependsOn` orders them, **no scope that reaches secrets, CI workflows, the deployment, edge or
Terraform folders, `ops/guardians` or the private notes**, and a validator that cannot write, runs
the tests and has a prompt unlike any worker's. Fix the plan until it passes. Do not argue with the check.

## 2. Workers

One worktree per task (`git worktree add`), each worker limited to its scope, each ending when its
acceptance command passes. Workers never see production credentials and never push to `main`.

## 3. Integrator

Brings the worktrees together on a branch, resolves conflicts, runs the whole suite, opens one PR.
The PR description lists the tasks, the plan and the real cost against the budget.

## 4. Independent validator

A separate agent with its own prompt, no write access, reading only the integrated diff. It runs the
tests and the type check itself and reports in this shape:

```
## Verdict
PASS | FAIL
## Commands run
- npm test -> 597 passed
## Diff reviewed
- apps/api/src/app/v1/x/route.ts
## Findings
- <severity> <file>: <what is wrong>
Wrote files: no
```

Check it with `node ops/skills/validate-report.mjs review -`. A FAIL needs a finding, a PASS cannot
sit next to a failing command. Only a PASS lets the PR go to a human; merging stays with the human.
