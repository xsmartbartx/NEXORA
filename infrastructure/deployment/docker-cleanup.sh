#!/usr/bin/env bash
# Weekly Docker cleanup on the shared NEXORA + Vigilo host, run from opc's
# crontab (Sundays 05:00 UTC, after the 03:00 backup):
#
#   0 5 * * 0 /opt/nexora/infrastructure/deployment/docker-cleanup.sh >> /opt/backups/docker-cleanup.log 2>&1
#
# Every deploy leaves 1-4 GB of build cache behind. This removes dangling
# images and build cache that has not been used for two days, so recent
# layers stay and the next deploys don't rebuild from scratch. Takes the same
# host-wide lock as deploy.sh so it never runs in the middle of a build.
#
# History: this used `builder prune --keep-storage 5GB`. On Docker 29 that flag
# is deprecated and reclaims nothing, so the cache grew to 41 GB (89% disk)
# before anyone noticed. The result is now logged from what Docker reports,
# and a run that frees nothing while the disk is fuller than the threshold is
# flagged in the log instead of quietly reporting "OK".
set -euo pipefail

THRESHOLD="${DISK_PRUNE_THRESHOLD:-75}"
KEEP="${CACHE_KEEP_HOURS:-48}"

exec 9>/opt/.platform-deploy.lock
flock -w 1800 9 || { echo "$(date -u +%FT%TZ) skipped: deploy lock busy for 30 minutes"; exit 1; }

pct() { df --output=pcent / | tail -1 | tr -d ' %'; }
reclaimed() { awk '/^Total:/ {print $2}'; }

before=$(pct)
sudo docker image prune -f > /dev/null
freed=$(sudo docker builder prune -f --all --filter "until=${KEEP}h" 2>&1 | reclaimed)

# A deploy-heavy week can outrun the age filter: if the disk is still full,
# drop every unused cache record.
if [ "$(pct)" -ge "$THRESHOLD" ]; then
  freed="${freed:-0B}+$(sudo docker builder prune -af 2>&1 | reclaimed)"
fi
after=$(pct)

status=OK
[ "$after" -ge "$THRESHOLD" ] && status="WARN disk still >= ${THRESHOLD}%"
echo "$(date -u +%FT%TZ) ${status} disk ${before}% -> ${after}% (build cache freed: ${freed:-0B})"
