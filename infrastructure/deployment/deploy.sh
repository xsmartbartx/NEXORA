#!/usr/bin/env bash
# The one way to deploy on the shared NEXORA + Vigilo host. Takes a host-wide
# lock so two deploys (from different people or sessions) never build or
# restart containers at the same time, then pulls and rebuilds only the
# services named.
#
#   deploy.sh nexora website console     # NEXORA services (docker-compose.prod.yml)
#   deploy.sh vigilo web api             # Vigilo services (its COMPOSE_FILE in .env)
#   deploy.sh neurawall control-plane    # NeuraWall (/opt/neurawall, deploy/compose/nexora-host.yml)
#   deploy.sh gateway api web            # standalone Gateway (/opt/gateway, deploy/compose.prod.yml)
#   deploy.sh edge                       # reload the shared Caddy config
#
# Waits up to 30 minutes for a running deploy to finish, then gives up.
set -euo pipefail

# Run as the deploy user, never as root: a root `git pull` leaves root-owned files in the checkout
# and the next ordinary deploy then fails with "unable to unlink ... Permission denied".
if [[ "$(id -u)" -eq 0 ]]; then
  exec sudo -u opc -- "$0" "$@"
fi

project="${1:?usage: deploy.sh nexora|vigilo|neurawall|gateway|edge [service...]}"
shift

exec 9>/opt/.platform-deploy.lock
if ! flock -n 9; then
  echo "Another deploy is running; waiting for it to finish..."
  flock -w 1800 9 || { echo "Gave up after 30 minutes waiting for the deploy lock." >&2; exit 1; }
fi

case "$project" in
  nexora)
    [ "$#" -gt 0 ] || { echo "Name the NEXORA services to deploy." >&2; exit 2; }
    cd /opt/nexora && git pull --ff-only
    cd infrastructure/docker
    compose=(sudo docker compose --env-file .env.prod -f docker-compose.prod.yml)
    "${compose[@]}" build "$@"
    "${compose[@]}" up -d --no-deps "$@"
    ;;
  vigilo)
    [ "$#" -gt 0 ] || { echo "Name the Vigilo services to deploy." >&2; exit 2; }
    cd /opt/vigilo && git pull --ff-only
    # Vigilo's /version reports this, so the running commit is visible from outside.
    # `sudo env` because sudo resets the environment and a plain `export` would not reach Docker.
    GIT_SHA="$(git rev-parse --short HEAD)"
    sudo env GIT_SHA="$GIT_SHA" docker compose build "$@"
    sudo env GIT_SHA="$GIT_SHA" docker compose up -d --no-deps "$@"
    ;;
  neurawall)
    [ "$#" -gt 0 ] || { echo "Name the NeuraWall services to deploy." >&2; exit 2; }
    cd /opt/neurawall && git pull --ff-only
    compose=(sudo docker compose --env-file .env -f deploy/compose/nexora-host.yml)
    "${compose[@]}" build "$@"
    "${compose[@]}" up -d --no-deps "$@"
    ;;
  gateway)
    [ "$#" -gt 0 ] || { echo "Name the Gateway services to deploy." >&2; exit 2; }
    cd /opt/gateway && git pull --ff-only
    compose=(sudo docker compose --env-file deploy/.env.prod -f deploy/compose.prod.yml)
    "${compose[@]}" build "$@"
    "${compose[@]}" up -d --no-deps "$@"
    ;;
  edge)
    cd /opt/nexora && git pull --ff-only
    sudo docker exec edge-caddy-1 caddy reload --config /etc/caddy/Caddyfile
    ;;
  *)
    echo "Unknown project: $project (expected nexora, vigilo, neurawall, gateway or edge)." >&2
    exit 2
    ;;
esac

# Keep the disk from filling between weekly cleanups: every deploy adds 1-4 GB of
# build cache, and a day of deploys has taken the disk from 77% to 90%. Above the
# threshold, drop all unused cache (the next build is just slower). The lock is held.
disk=$(df --output=pcent / | tail -1 | tr -d ' %')
if [ "$disk" -ge "${DISK_PRUNE_THRESHOLD:-75}" ]; then
  freed=$(sudo docker builder prune -af 2>&1 | awk '/^Total:/ {print $2}')
  echo "Disk was ${disk}%: pruned build cache, freed ${freed:-0B}"
fi

echo "Deployed $project${*:+: $*} at $(date -u +%FT%TZ) ($(git -C "/opt/${project/edge/nexora}" log --oneline -1))"
