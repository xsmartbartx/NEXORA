#!/usr/bin/env bash
# Nightly backup of every stateful thing on this server: Vigilo's Postgres
# and MinIO evidence volume, NEXORA's Postgres, and NeuraWall's Postgres plus its
# data volume (holds the bundle-signing key every enrolled node trusts). Uses `docker exec`
# directly rather than `docker compose exec`, so it doesn't depend on
# either stack's .env being loadable.
#
# Each archive is kept here for 14 days and copied off-site to OCI Object
# Storage (bucket $BUCKET), authenticated as this instance via instance
# principal — no credentials on disk. The server may only create objects
# there, not delete them; expiry is the bucket's own lifecycle rule, so a
# compromised host cannot wipe the off-site copies.
set -euo pipefail

BUCKET=nexora-backups
HEARTBEAT=/opt/backups/heartbeat/last-success
dest=/opt/backups/archives
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
archive="$dest/platform-backup-$stamp.tar.gz"
object="platform/$(basename "$archive")"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

# Expire old archives first: if the disk is nearly full of them, the new archive must be able to
# be written (a failed tar under `set -e` would otherwise stop before any space was reclaimed).
find "$dest" -name 'platform-backup-*.tar.gz' -mtime +14 -delete

# Docker silently creates an empty volume for a name that does not exist, and an archive of an
# empty volume would look like a success. A missing volume must fail the backup instead.
for volume in neurawall_cpdata vigilo-self-host_vigilo_self_host_minio_data; do
  docker volume inspect "$volume" >/dev/null 2>&1 || {
    echo "$(date -u) FAILED: volume $volume does not exist, nothing was backed up" >&2
    exit 1
  }
done

docker exec vigilo-self-host-postgres-1 pg_dump -U vigilo -d vigilo -Fc > "$work/vigilo-postgres.dump"
docker exec nexora-postgres-1 pg_dump -U postgres -d nexora -Fc > "$work/nexora-postgres.dump"
docker exec neurawall-postgres-1 pg_dump -U neurawall -d neurawall -Fc > "$work/neurawall-postgres.dump"
docker run --rm \
  -v neurawall_cpdata:/data:ro \
  -v "$work:/backup" \
  alpine tar czf /backup/neurawall-data.tar.gz -C /data .
docker run --rm \
  -v vigilo-self-host_vigilo_self_host_minio_data:/data:ro \
  -v "$work:/backup" \
  alpine tar czf /backup/vigilo-minio.tar.gz -C /data .

tar czf "$archive" -C "$work" .
echo "$(date -u) OK local $archive $(du -h "$archive" | cut -f1)"

# --no-multipart: above ~128 MiB the CLI switches to multipart upload, which the instance's policy
# (OBJECT_CREATE and OBJECT_INSPECT only, policy nexora-backups in OCI) does not allow. OCI then answers
# with a misleading BucketNotFound. Uploads of this size are fine as a single PUT (limit 50 GiB).
if oci os object put --auth instance_principal --bucket-name "$BUCKET" \
    --file "$archive" --name "$object" --no-overwrite --no-multipart \
    >/dev/null 2>"$work/upload.err"; then
  echo "$(date -u) OK off-site oci://$BUCKET/$object"
  # Only a fully successful run (local + off-site) advances the heartbeat
  # that status.onenexora.com/api/backup serves to the uptime workflow.
  mkdir -p "$(dirname "$HEARTBEAT")"
  date -u +%s > "$HEARTBEAT.tmp" && mv "$HEARTBEAT.tmp" "$HEARTBEAT"
else
  echo "$(date -u) UPLOAD FAILED: $(grep -m1 -E '"(code|message)"' "$work/upload.err" || head -c 300 "$work/upload.err")"
  exit 1
fi
