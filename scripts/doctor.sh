#!/usr/bin/env bash
# Checks this machine has what the repo needs. Exits non-zero only when a
# required tool is missing or too old; optional tools just warn.
#
#   npm run doctor
set -uo pipefail

failed=0
ok() { printf '  \033[32m✓\033[0m %s\n' "$1"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$1"; }
bad() { printf '  \033[31m✗\033[0m %s\n' "$1"; failed=1; }

major() { sed -E 's/^v?([0-9]+).*/\1/'; }

echo "Required"
for tool in git gh docker terraform curl jq openssl node npm; do
  command -v "$tool" >/dev/null 2>&1 || { bad "$tool: not installed (brew bundle)"; continue; }
  case "$tool" in
    node)
      v=$(node -v); m=$(printf %s "$v" | major)
      if [ "$m" -lt 20 ]; then bad "node $v: package.json engines needs >=20"
      elif [ "$m" -ne 22 ]; then warn "node $v: works, but CI and the Docker image build on 22"
      else ok "node $v"; fi ;;
    npm)
      v=$(npm -v); m=$(printf %s "$v" | major)
      # node 22 ships npm 10, whose `npm ci` rejects this repo's lockfile.
      if [ "$m" -ne 11 ]; then bad "npm $v: lockfile is written by npm 11 (npm install -g npm@11)"
      else ok "npm $v"; fi ;;
    docker)
      if docker info >/dev/null 2>&1; then ok "docker (daemon running)"
      else bad "docker: installed but the daemon isn't running (start Docker Desktop)"; fi ;;
    *) ok "$tool" ;;
  esac
done

echo "Optional"
optional() { # tool, what it's for
  if command -v "$1" >/dev/null 2>&1; then ok "$1"; else warn "$1: not installed (only for $2)"; fi
}
optional psql "querying Postgres directly"
optional redis-cli "inspecting Redis"
optional oci "managing the Oracle Cloud host"

echo
if [ "$failed" -eq 0 ]; then echo "Ready."; else echo "Fix the ✗ items above, then re-run."; fi
exit "$failed"
