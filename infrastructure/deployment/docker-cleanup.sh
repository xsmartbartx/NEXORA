#!/usr/bin/env bash
# Weekly Docker cleanup on the shared NEXORA + Vigilo host, run from opc's
# crontab (Sundays 05:00 UTC, after the 03:00 backup):
#
#   0 5 * * 0 /opt/nexora/infrastructure/deployment/docker-cleanup.sh >> /opt/backups/docker-cleanup.log 2>&1
#
# Every deploy leaves ~1-2 GB of build cache behind. This removes dangling
# images and trims the build cache to 5 GB — recent layers stay, so the
# next deploys don't rebuild from scratch. Takes the same host-wide lock as
# deploy.sh so it never runs in the middle of a build.
set -euo pipefail

exec 9>/opt/.platform-deploy.lock
flock -w 1800 9 || { echo "$(date -u +%FT%TZ) skipped: deploy lock busy for 30 minutes"; exit 1; }

before=$(df --output=pcent / | tail -1 | tr -d ' ')
sudo docker image prune -f > /dev/null
sudo docker builder prune -f --keep-storage 5GB > /dev/null
after=$(df --output=pcent / | tail -1 | tr -d ' ')

echo "$(date -u +%FT%TZ) OK disk ${before} -> ${after}"
