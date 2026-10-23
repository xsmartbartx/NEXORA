---
name: end
description: End-of-session review for the NEXORA repo. Summarises what the session did in under 300 words and proposes at most three measurable improvements, each with a metric, a baseline, a target and a way to measure it. Read-only. Use when the user types /end or says they are finishing the session.
allowed-tools: Bash(git status:*), Bash(git log:*), Bash(git diff --stat:*), Bash(node ops/skills/validate-report.mjs:*)
---

# /end: close the session with a short summary and at most three measurable improvements

You only read. You change no files, run nothing that writes, and never read secret files
(`.env*`, `*.pem`, key files, session transcripts). This is an instruction, not a sandbox: `allowed-tools`
only pre-approves the commands listed above and does not remove other tools. The hard boundary is the
Guardians hook (`ops/guardians`), which blocks secret paths and destructive commands. If the session touched secrets, say that it did,
never what they were.

## 1. Summary (under 300 words)

What was done, what was decided, what is left open and who owns it. Facts from this session and from
`git status` / `git log`, not guesses. Say plainly what was NOT verified.

## 2. Improvements (at most three)

Only where this session showed a real cost: a repeated mistake, a manual step done more than once, a
check that came too late. For each one, all four fields, and the baseline must be a number you can point at:

```
### 1. <short title>
- Metric: <what is counted or timed>
- Baseline: <today's value, with where it came from>
- Target: <value that would mean it worked>
- Measurement: <exact command, query or dashboard that gives the number>
```

No proposal without all four. If nothing qualifies, write "No improvement proposed" instead of padding.

## 3. Check your own output

Pipe the report to the checker, no file needed:
`node ops/skills/validate-report.mjs end - <<'REPORT'` ... `REPORT`. Fix what it reports, then show the
report. Shape: `## Summary` (non-empty), then `## Improvements`.
