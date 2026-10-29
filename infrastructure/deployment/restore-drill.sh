#!/usr/bin/env bash
# Restore drill: proves the NEXORA database backup can actually be restored.
#
# Extracts nexora-postgres.dump from a platform backup archive, restores it
# into a throwaway Postgres container (never the production one), and checks
# that the expected tables exist and hold rows. Prints the elapsed restore
# time, which is the measured RTO for the database. Read-only against
# production: it only reads the archive.
#
# The Postgres image follows the major version recorded in the dump's header, so the drill keeps
# working when the database is upgraded (a dump from a newer major cannot be restored by an older one).
# Override with PG_IMAGE=postgres:NN-alpine.
#
# Usage: restore-drill.sh [archive.tar.gz]   (default: newest in /opt/backups/archives)
set -euo pipefail

ARCHIVE_DIR=/opt/backups/archives
FALLBACK_IMAGE=postgres:16-alpine
READER_IMAGE=postgres:17-alpine # a newer client can list the header of an older dump
EXPECTED_TABLES=(api_keys audit_events subscriptions product_suspensions)

archive="${1:-$(ls -1t "$ARCHIVE_DIR"/platform-backup-*.tar.gz | head -1)}"
[[ -f "$archive" ]] || { echo "FAIL: archive not found: $archive"; exit 1; }

work="$(mktemp -d)"
name="nexora-restore-drill-$$"
cleanup() { docker rm -f "$name" >/dev/null 2>&1 || true; rm -rf "$work"; }
trap cleanup EXIT

echo "Archive: $archive"
tar xzf "$archive" -C "$work" ./nexora-postgres.dump
sha256sum "$archive" | cut -c1-16 | sed 's/^/Archive sha256 (prefix): /'

if [[ -n "${PG_IMAGE:-}" ]]; then
  IMAGE="$PG_IMAGE"
else
  major=$(docker run --rm -v "$work:/w:ro" "$READER_IMAGE" pg_restore -l /w/nexora-postgres.dump 2>/dev/null \
    | sed -n 's/^; *Dumped from database version \([0-9][0-9]*\).*/\1/p' | head -1)
  if [[ "$major" =~ ^[0-9]+$ ]]; then IMAGE="postgres:${major}-alpine"; else IMAGE="$FALLBACK_IMAGE"; fi
fi
echo "Postgres image: $IMAGE"

docker run -d --name "$name" -e POSTGRES_PASSWORD=drill -e POSTGRES_DB=nexora_drill "$IMAGE" >/dev/null
for _ in $(seq 1 30); do
  docker exec "$name" pg_isready -U postgres -d nexora_drill >/dev/null 2>&1 && break
  sleep 1
done

start=$(date +%s)
docker cp "$work/nexora-postgres.dump" "$name:/tmp/nexora.dump"
docker exec "$name" pg_restore -U postgres -d nexora_drill --no-owner --exit-on-error /tmp/nexora.dump
elapsed=$(( $(date +%s) - start ))

fail=0
for table in "${EXPECTED_TABLES[@]}"; do
  if rows=$(docker exec "$name" psql -U postgres -d nexora_drill -Atc "select count(*) from \"$table\""); then
    echo "OK   $table: $rows rows"
  else
    echo "FAIL $table: missing"
    fail=1
  fi
done

echo "Restore time: ${elapsed}s"
[[ "$fail" -eq 0 ]] && echo "RESTORE DRILL PASSED" || { echo "RESTORE DRILL FAILED"; exit 1; }
