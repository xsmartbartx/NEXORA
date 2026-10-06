#!/usr/bin/env bash
# Daily audit-event retention on the NEXORA host, run from opc's crontab
# (04:00 UTC, after the 03:00 backup):
#
#   0 4 * * * /opt/nexora/infrastructure/deployment/audit-retention.sh >> /opt/backups/audit-retention.log 2>&1
#
# Deletes audit_events older than RETENTION_DAYS (default 400: longer than a
# yearly billing period, which is the longest window Usage and entitlement
# counts read). Deletes in batches so a large backlog never holds a long lock.
# The privacy policy states this period (apps/website legal/privacy, section 4);
# change both together.
set -euo pipefail

DAYS="${RETENTION_DAYS:-400}"
BATCH="${RETENTION_BATCH:-5000}"
[[ "$DAYS" =~ ^[0-9]+$ && "$DAYS" -ge 366 ]] || { echo "RETENTION_DAYS must be an integer >= 366 (got '$DAYS')" >&2; exit 2; }
[[ "$BATCH" =~ ^[0-9]+$ ]] || { echo "RETENTION_BATCH must be an integer" >&2; exit 2; }

total=0
while :; do
  n=$(sudo docker exec nexora-postgres-1 psql -U postgres -d nexora -At -c "
    with doomed as (
      select id from audit_events
      where created_at < now() - interval '${DAYS} days'
      limit ${BATCH}
    ), gone as (delete from audit_events where id in (select id from doomed) returning 1)
    select count(*) from gone;" </dev/null)
  total=$((total + n))
  [ "$n" -lt "$BATCH" ] && break
  sleep 1
done
echo "$(date -u +%FT%TZ) audit retention: deleted ${total} audit_events older than ${DAYS} days"
