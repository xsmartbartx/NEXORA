#!/usr/bin/env bash
# Runs tests/api's Postman collection with Newman.
#
#   scripts/api-test.sh [local|production]
#
#   API_BASE_URL  overrides the environment file's baseUrl (CI points this at
#                 a container it just started)
#   API_KEY       a real nx_live_... key; when set, the authenticated folder
#                 runs too
#
# Always runs the public and no-key rejection folders (they need no
# database). `production` adds the invalid-key folder, which needs a
# database-backed API — against a bare container it returns 500, not 401.
set -euo pipefail
cd "$(dirname "$0")/.."

env_name="${1:-local}"
case "$env_name" in
  local | production) ;;
  *) echo "usage: $0 [local|production]" >&2; exit 2 ;;
esac

folders=("1. Public" "2. Auth rejection (no key, no database needed)")
[ "$env_name" = "production" ] && folders+=("3. Invalid key (needs a database)")
[ -n "${API_KEY:-}" ] && folders+=("4. Authenticated (needs a real apiKey)")

args=(run tests/api/nexora-api.postman_collection.json
  -e "tests/api/${env_name}.postman_environment.json" --color on)
for f in "${folders[@]}"; do args+=(--folder "$f"); done
[ -n "${API_BASE_URL:-}" ] && args+=(--env-var "baseUrl=${API_BASE_URL}")
[ -n "${API_KEY:-}" ] && args+=(--env-var "apiKey=${API_KEY}")

exec npx --yes newman@6.2.2 "${args[@]}"
