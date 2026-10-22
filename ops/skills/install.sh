#!/usr/bin/env bash
# Links the End and Czujka skills into ~/.claude/skills so /end and Czujka are available in every
# Claude Code session. Symlinks, so a `git pull` updates them. Run by a person; changes only that folder.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
dest="${HOME}/.claude/skills"
mkdir -p "$dest"
for name in end czujka; do
  ln -sfn "$here/$name" "$dest/nexora-$name"
  echo "linked $dest/nexora-$name -> $here/$name"
done
