# Cloud Worker v1

Runs the approved recurring jobs of the platform from a timer on the host, so they no longer depend
on a desktop app being open. A job is a small file in `jobs/`; merging it is the approval (the repo
is the allow-list).

| job              | schedule | runs                                                                      |
| ---------------- | -------- | ------------------------------------------------------------------------- |
| `restore-drill`  | monthly  | `restore-drill.sh`: restores the newest backup into a throwaway container |
| `backup-listing` | daily    | read-only listing of `/opt/backups`                                       |

## Rules every job obeys

- **Once per period (UTC).** Each attempt is its own file, `runs/<job>__<period>.<n>.json`, created exclusively, so two starters
  (cron overlap, a manual run during `run-due`) cannot both own an attempt, and nobody deletes anyone
  else's claim. A second start the same day, week or month does nothing. A failed run
  is retried by the next invocation, at most 3 attempts per period, then it gives up and says so.
- **Closed command set.** `command` must be accepted by the Guardians G2 registry
  (`ops/guardians/host/nexora-guard.mjs`): no free-form shell. Guarded commands (`db-migrate`,
  `deploy edge`) need `requiresApproval: true` and a human-created, single-use approval.
- **Cost limits.** Before anything starts: the kill switch (`KILL` file), the monthly limit of
  `ops/costsec/budget.json` (10 USD, stop at 100 %) against `ledger.jsonl`, and the job's own
  `maxCostUsd` ceiling (at most 10). An invalid budget file stops everything. These two jobs cost
  nothing; the gate exists for the model-using jobs that come later.
- **Timeout** per job, **rollback** written down in every job file (validated to be present).
- **Visible.** Every outcome is a line in `runs.jsonl`; a failure also reaches the Notification Hub
  (`worker.<job>` source) through the console container.

## Commands

`node ops/worker/worker.mjs run-due` runs every enabled job that has no finished run in its period;
`run <jobId>` runs one; `status` prints the state of each. Exit code 1 means a job failed, 2 a bad
registry or usage.

## Turning it on (production; needs a person)

1. `sudo mkdir -p /opt/nexora/worker && sudo chown opc /opt/nexora/worker`.
2. Cron as `opc`, hourly (a run-due that finds nothing due is a no-op):
   ```
   7 * * * * cd /opt/nexora && /usr/bin/node ops/worker/worker.mjs run-due >> /opt/nexora/worker/cron.log 2>&1
   ```
3. Kill switch: `touch /opt/nexora/worker/KILL` stops all jobs at once; remove it to resume.
   A different limit for the host: put a `budget.json` in `/opt/nexora/worker/`; a host file that exists but is
   unreadable or invalid stops the worker (only a missing file falls back to the repository default).
4. Check: `node ops/worker/worker.mjs status`, then the next day's `runs.jsonl`.

## Limits

State is files on one host, not rows in Postgres: no Control Center page for job runs yet, and
two hosts would need a shared disk. Moving the ledger and runs into a `job_runs` table is the
next step if you want them on the Control Center page. Jobs are JSON, not YAML, to avoid a
parser dependency.
