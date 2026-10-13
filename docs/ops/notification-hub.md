# Notification Hub

The Hub turns "something on the Control Center page is wrong" into a message on a phone, once, and
tells you when it is over. It does not replace the Control Center, Grafana or the uptime workflow; it
sits on top of them.

## Why it exists

Before the Hub the only things that reached a person were an e-mail from GitHub when the uptime
workflow failed and whatever Grafana could send. Grafana's alert rules were provisioned from files
but its container had been started before those files existed, and Grafana reads provisioning only
at start, so it ran for days with zero rules. Its SMTP settings were empty as well. The Control
Center knew what was wrong but only showed it to someone who opened the page.

## How it works

```
Control Center ──(every 5 min, POST /tick)──┐
  attention.ts: down endpoints, backups,     │
  disk, certificates, 5xx, CI, ...           ▼
                                   reconcile against ops_alerts ──► message
Grafana webhook ──(POST /events)────────────┘        │               (ntfy / Discord /
  postgres/redis down, disk, ...                      ▼                Slack / JSON)
                                              audit_events journal
```

- **One incident per problem.** A problem is identified by a fingerprint of its source and wording
  with digits folded away, so "13 owner reviews overdue" turning into "12" is the same incident.
- **New** problems are announced at once (critical always; warnings not during quiet hours).
- **Still open** problems are not repeated. A critical one is reminded every 6 hours; a warning never.
- **Escalation** (warning to critical) is announced immediately, even in quiet hours.
- **Resolved** is announced when a polled problem has been absent for 2 polls in a row, or when
  Grafana says so. It is only sent if you were told about the problem in the first place.
- **A failed poll resolves nothing.** If the Control Center cannot be collected, nothing is concluded.
- **A failed delivery is retried** on the next tick, because an unsent alert is never marked sent.
- **At most 10 messages per tick**, new criticals first; the rest follow on the next tick.
- Items that belong on the page only (overdue owner reviews) are filtered out of the push.

State lives in `ops_alerts` (one row per incident, resolved rows kept as history). What was sent
and what failed is in `audit_events` under actor `ops-hub`.

## Endpoints

Both are for machines on the compose network only.

| endpoint                   | method | body                                                                                       | purpose                                      |
| -------------------------- | ------ | ------------------------------------------------------------------------------------------ | -------------------------------------------- |
| `/api/internal/ops/tick`   | POST   | none                                                                                       | poll the Control Center, reconcile, announce |
| `/api/internal/ops/events` | POST   | Grafana webhook, or `{ source, title, severity?, detail?, status? }` / `{ events: [...] }` | push one or more alerts                      |

- Authentication is `Authorization: Bearer $OPS_HUB_TOKEN`, compared in constant time. With no token
  (or one shorter than 24 characters) the routes answer **404**: they do not exist.
- The edge Caddy answers 404 to `/api/internal/*` from the internet, so a request has to come from
  inside the compose network (Grafana, or `docker exec` on the host).
- Replies are counts only, never alert text.

## Configuration

All optional except the token. Set them in the production env file (they reach the console through
`docker-compose.prod.yml`).

| variable                   | meaning                                                                                         |
| -------------------------- | ----------------------------------------------------------------------------------------------- |
| `OPS_HUB_TOKEN`            | shared secret for the endpoints and for Grafana's webhook. Generate with `openssl rand -hex 32` |
| `OPS_NOTIFY_WEBHOOK_URL`   | where messages go (https only). A secret: it usually contains a topic or token                  |
| `OPS_NOTIFY_FORMAT`        | `ntfy`, `discord`, `slack` or `generic`; guessed from the host when unset                       |
| `OPS_QUIET_HOURS`          | e.g. `23:00-07:00`: warnings wait, criticals never do                                           |
| `OPS_QUIET_TZ`             | time zone for quiet hours, default `Europe/Warsaw`                                              |
| `OPS_REMINDER_HOURS`       | reminder interval for open criticals, default 6                                                 |
| `OPS_RESOLVE_AFTER_MISSED` | clean polls before "resolved", default 2                                                        |
| `OPS_NOTIFY_MAX_PER_TICK`  | messages per tick, default 10                                                                   |
| `OPS_HEARTBEAT_URL`        | an external dead man's switch pinged after every successful tick                                |

With no channel configured the Hub still tracks and journals alerts; nothing is sent, and the first
tick after you add a channel announces everything that is open.

### Choosing a channel

- **ntfy** (`https://ntfy.sh/<topic>`): free push to a phone app. The topic name is the only
  secret, so make it long and random, or self-host ntfy.
- **Discord / Slack**: paste the incoming-webhook URL.
- **generic**: a JSON body `{ title, message, severity, kind, source, url }` for anything else.

## Turning it on (production, in this order)

These change production and need a person.

1. Add `OPS_HUB_TOKEN` and `OPS_NOTIFY_WEBHOOK_URL` (and optionally the rest) to the production env file.
2. Apply the migration: `deploy.sh nexora db-migrate` (adds the `ops_alerts` table).
3. `deploy.sh nexora console` (the endpoints) and reload the edge: `deploy.sh edge`.
4. **Recreate Grafana** so it reads the rules and the webhook contact point (provisioning is read
   only at start): `deploy.sh nexora grafana`. Then confirm the rules loaded, for example
   `grafana_alerting_schedule_alert_rules` is 4 in Grafana's `/metrics`.
5. Restart Prometheus to pick up the new `grafana` scrape job (it was not scraped before).
6. Install the schedule on the host, every 5 minutes, as the deploy user:

   ```
   */5 * * * * docker exec nexora-console-1 sh -c 'wget -q -O- -T 120 --header "Authorization: Bearer $OPS_HUB_TOKEN" --post-data="" http://127.0.0.1:3002/api/internal/ops/tick' >> /opt/backups/ops-hub-tick.log 2>&1
   ```

   The token is read inside the container, so it never appears in the crontab.

7. Check: the tick returns a JSON summary with `"ran":true`; stopping a non-critical container for a
   few minutes produces a message, and then a "resolved" message once it is back.

## Limits

- One console process runs one tick at a time; the Hub assumes a single console container.
- If the Hub itself stops (the cron dies, the console is down) it cannot tell you. Set
  `OPS_HEARTBEAT_URL` to an external check (healthchecks.io or similar) that alerts you when the pings stop.
- The Hub reports what the Control Center and Grafana already know. It adds no new probes except
  one: it flags Grafana running with no rules loaded.
- Grafana's own e-mail still needs `GRAFANA_SMTP_PASSWORD`; the webhook does not.
- A pushed incident that nobody refreshes for 12 hours is closed without a message.
