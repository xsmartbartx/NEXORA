#!/usr/bin/env bash
# Full-data restore rehearsal: restores all three Postgres dumps of the newest archive into
# throwaway containers (NeuraWall runs PostgreSQL 17, the others 16), never touching production,
# and prints per-database timings (the measured restore time for each). Run it on the host; it
# needs about twice the archive size in free disk and, for NeuraWall, around 7 minutes.
#
# Usage: restore-rehearsal.sh   (newest archive in /opt/backups/archives)
set -euo pipefail
archive="$(ls -1t /opt/backups/archives/platform-backup-*.tar.gz | head -1)"
work="$(mktemp -d)"
names=()
cleanup() {
  for n in "${names[@]}"; do docker rm -f "$n" >/dev/null 2>&1 || true; done
  rm -rf "$work"
}
trap cleanup EXIT
t0=$(date +%s)
echo "archive: $(basename "$archive") $(du -h "$archive" | cut -f1)"
tar xzf "$archive" -C "$work"
echo "extracted in $(( $(date +%s) - t0 ))s"

restore() { # db image
  local db="$1" image="$2" name="rehearsal-$1-$$" t
  names+=("$name")
  t=$(date +%s)
  docker run -d --name "$name" -e POSTGRES_PASSWORD=rehearsal "$image" >/dev/null
  for _ in $(seq 1 60); do docker exec "$name" pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done
  docker exec "$name" createdb -U postgres "$db"
  docker cp "$work/$db-postgres.dump" "$name:/tmp/$db.dump"
  docker exec "$name" pg_restore -U postgres -d "$db" --no-owner --no-privileges "/tmp/$db.dump" 2>"$work/$db.err" || true
  local tables rows errors
  tables=$(docker exec "$name" psql -U postgres -d "$db" -Atc "select count(*) from information_schema.tables where table_schema='public'")
  rows=$(docker exec "$name" psql -U postgres -d "$db" -Atc "select coalesce(sum(n_live_tup),0)::bigint from pg_stat_user_tables")
  errors=$(grep -c -i error "$work/$db.err" || true)
  echo "$db ($image): ${tables} tables, ~${rows} rows, $(( $(date +%s) - t ))s, errors: ${errors}"
  if [[ "$errors" != "0" ]]; then head -c 400 "$work/$db.err"; echo; fi
}

restore nexora postgres:16-alpine
restore vigilo postgres:16-alpine
restore neurawall postgres:17-alpine
for f in neurawall-data.tar.gz vigilo-minio.tar.gz; do
  echo "$f: $(tar tzf "$work/$f" | wc -l) entries"
done
echo "TOTAL: $(( $(date +%s) - t0 ))s"
