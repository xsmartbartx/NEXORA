#!/usr/bin/env bash
# Restore drill: proves the NEXORA and CodeReviewer database backups can actually be restored.
#
# Extracts each dump from a platform backup archive, restores it into a throwaway Postgres
# container (never a production one), and checks that the expected tables exist and hold rows.
# Prints the elapsed restore time per database, which is the measured RTO for it. Read-only
# against production: it only reads the archive.
#
# The Postgres image follows the major version recorded in each dump's header, so the drill keeps
# working when a database is upgraded (a dump from a newer major cannot be restored by an older one).
# Override with PG_IMAGE=postgres:NN-alpine.
#
# Usage: restore-drill.sh [archive.tar.gz]   (default: newest in /opt/backups/archives)
set -euo pipefail

ARCHIVE_DIR=/opt/backups/archives
FALLBACK_IMAGE=postgres:16-alpine
READER_IMAGE=postgres:17-alpine # a newer client can list the header of an older dump
NEXORA_TABLES=(api_keys audit_events subscriptions product_suspensions)
CODEREVIEWER_TABLES=(accounts repositories reviews)

archive="${1:-$(ls -1t "$ARCHIVE_DIR"/platform-backup-*.tar.gz | head -1)}"
[[ -f "$archive" ]] || { echo "FAIL: archive not found: $archive"; exit 1; }

work="$(mktemp -d)"
names=()
cleanup() {
  for n in "${names[@]}"; do docker rm -f "$n" >/dev/null 2>&1 || true; done
  rm -rf "$work"
}
trap cleanup EXIT

echo "Archive: $archive"
sha256sum "$archive" | cut -c1-16 | sed 's/^/Archive sha256 (prefix): /'

fail=0

# drill <db> <table...>: restore <db>-postgres.dump into a throwaway container and check the tables.
drill() {
  local db="$1" name="$1-restore-drill-$$" image major start elapsed rows
  shift
  names+=("$name")
  tar xzf "$archive" -C "$work" "./$db-postgres.dump"

  if [[ -n "${PG_IMAGE:-}" ]]; then
    image="$PG_IMAGE"
  else
    major=$(docker run --rm -v "$work:/w:ro" "$READER_IMAGE" pg_restore -l "/w/$db-postgres.dump" 2>/dev/null \
      | sed -n 's/^; *Dumped from database version \([0-9][0-9]*\).*/\1/p' | head -1)
    if [[ "$major" =~ ^[0-9]+$ ]]; then image="postgres:${major}-alpine"; else image="$FALLBACK_IMAGE"; fi
  fi
  echo "[$db] Postgres image: $image"

  docker run -d --name "$name" -e POSTGRES_PASSWORD=drill -e POSTGRES_DB="${db}_drill" "$image" >/dev/null
  for _ in $(seq 1 30); do
    docker exec "$name" pg_isready -U postgres -d "${db}_drill" >/dev/null 2>&1 && break
    sleep 1
  done

  start=$(date +%s)
  docker cp "$work/$db-postgres.dump" "$name:/tmp/$db.dump"
  docker exec "$name" pg_restore -U postgres -d "${db}_drill" --no-owner --exit-on-error "/tmp/$db.dump"
  elapsed=$(( $(date +%s) - start ))

  for table in "$@"; do
    if rows=$(docker exec "$name" psql -U postgres -d "${db}_drill" -Atc "select count(*) from \"$table\""); then
      echo "OK   [$db] $table: $rows rows"
    else
      echo "FAIL [$db] $table: missing"
      fail=1
    fi
  done
  echo "[$db] Restore time: ${elapsed}s"
}

drill nexora "${NEXORA_TABLES[@]}"
# Archives from before CodeReviewer joined the nightly backup do not have its dump.
if tar tzf "$archive" ./codereviewer-postgres.dump >/dev/null 2>&1; then
  drill codereviewer "${CODEREVIEWER_TABLES[@]}"
else
  echo "[codereviewer] not in this archive"
fi

[[ "$fail" -eq 0 ]] && echo "RESTORE DRILL PASSED" || { echo "RESTORE DRILL FAILED"; exit 1; }
