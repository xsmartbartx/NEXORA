---
name: czujka
description: Weekly watch for repeated work in the NEXORA repo. Reads only metadata (git history, pull request and CI run metadata, overdue reviews), finds recurring manual processes and proposes automations with frequency, estimated saving and risk. Read-only. Use for the weekly report or when asked what could be automated.
allowed-tools: Read, Bash(node ops/skills/czujka-metadata.mjs:*), Bash(node ops/skills/validate-report.mjs:*), Bash(gh pr list:*), Bash(gh run list:*)
---

# Czujka: find work that repeats and propose automation

**Metadata only.** Your inputs are the output of `node ops/skills/czujka-metadata.mjs` and, if
useful, `gh pr list --json number,title,state,createdAt,mergedAt` and
`gh run list --json name,conclusion,createdAt`. Do not open source files, diffs, `.env*`, keys,
transcripts or private notes. A proposal rests on counts and names, never on file contents.

## What counts as a repeated process

- The same kind of change made again and again (commit-subject prefixes, the same files changed together).
- A fix that follows almost every change to the same area.
- A manual step that shows up in several pull requests.
- A scheduled review that is routinely overdue.

## Each proposal needs

```
### <short title>
- Source: <which metadata: git log, PR list, CI runs, ...>
- Frequency: <how often it happened, in what period>
- Estimated saving: <minutes per occurrence x frequency, and how you got the minutes>
- Risk: <what could go wrong if automated, and the guard>
```

No proposal without all four. Rank by saving. Say so when the data is too thin to propose anything.
Existing mechanisms come first: check whether the Control Center, the Notification Hub, the Cloud
Worker (`ops/worker/jobs`) or CI already covers it, and say so instead of proposing a duplicate.

## Check your own output

Write the report to a scratch file and run `node ops/skills/validate-report.mjs czujka <file>`.
