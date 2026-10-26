#!/usr/bin/env bash
# Second off-site copy of the nightly backup, at a provider other than OCI, so that losing the OCI
# account does not lose the server AND its backups.
#
# Each new archive is encrypted on this host with a PUBLIC key (gpg --encrypt), so the host can
# write the copy but can never read it back: the private key stays with the owner, offline.
# The encrypted file is then pushed with rclone to a remote the owner configured on this host.
#
# Setup (owner, once; nothing here creates accounts or credentials):
#   1. gpg --import backup-public.asc          (public key only)
#   2. rclone config                            (a remote for e.g. Hetzner Storage Box or Backblaze B2)
#   3. /opt/backups/offsite.env, mode 600:
#        OFFSITE_GPG_RECIPIENT=<key id or e-mail of the public key>
#        OFFSITE_REMOTE=<rclone remote>:<bucket or folder>/nexora
#   4. cron, after the nightly backup (03:00):   30 3 * * * /opt/nexora/infrastructure/deployment/offsite-copy.sh >> /opt/backups/offsite.log 2>&1
#
# Idempotent: an archive already listed in the state file is skipped. A failed run exits non-zero
# and does not advance the heartbeat.
set -euo pipefail

CONFIG="${OFFSITE_CONFIG:-/opt/backups/offsite.env}"
ARCHIVES="${OFFSITE_ARCHIVES:-/opt/backups/archives}"
STATE="${OFFSITE_STATE:-/opt/backups/offsite-copied.txt}"
HEARTBEAT="${OFFSITE_HEARTBEAT:-/opt/backups/heartbeat/offsite-last-success}"

fail() {
  echo "$(date -u) OFFSITE FAILED: $1" >&2
  exit 1
}

[[ -r "$CONFIG" ]] || fail "$CONFIG is missing; see the setup notes at the top of this script"
# shellcheck source=/dev/null
source "$CONFIG"
[[ -n "${OFFSITE_GPG_RECIPIENT:-}" ]] || fail "OFFSITE_GPG_RECIPIENT is not set in $CONFIG"
[[ -n "${OFFSITE_REMOTE:-}" ]] || fail "OFFSITE_REMOTE is not set in $CONFIG"
command -v gpg >/dev/null || fail "gpg is not installed"
command -v rclone >/dev/null || fail "rclone is not installed"

latest="$(find "$ARCHIVES" -name 'platform-backup-*.tar.gz' | sort | tail -1)"
[[ -n "$latest" ]] || fail "no archive found in $ARCHIVES"
name="$(basename "$latest")"
touch "$STATE"

if grep -qxF "$name" "$STATE"; then
  echo "$(date -u) OFFSITE skipped: $name already copied"
  exit 0
fi

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
encrypted="$work/$name.gpg"

# --encrypt with a recipient: public-key only, no passphrase on this host, no way to decrypt here.
gpg --batch --yes --trust-model always --encrypt --recipient "$OFFSITE_GPG_RECIPIENT" \
  --output "$encrypted" "$latest" || fail "encryption failed"

rclone copyto "$encrypted" "$OFFSITE_REMOTE/$name.gpg" || fail "upload failed"

# Trust but verify: the remote copy must have the size of what was sent.
sent="$(wc -c < "$encrypted" | tr -d ' ')"
remote_size="$(rclone size --json "$OFFSITE_REMOTE/$name.gpg" | sed -n 's/.*"bytes":\([0-9]*\).*/\1/p')"
[[ "$sent" == "$remote_size" ]] || fail "size mismatch after upload (sent $sent, remote ${remote_size:-unknown})"

echo "$name" >> "$STATE"
mkdir -p "$(dirname "$HEARTBEAT")"
date -u +%s > "$HEARTBEAT"
echo "$(date -u) OFFSITE OK $name -> $OFFSITE_REMOTE ($sent bytes, encrypted)"
