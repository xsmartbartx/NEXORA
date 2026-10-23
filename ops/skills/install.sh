#!/usr/bin/env bash
# Links the End and Czujka skills into ~/.claude/skills so /end and Czujka are available in every
# Claude Code session. Symlinks, so a `git pull` updates them. Run by a person; changes only that folder.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
dest="${HOME}/.claude/skills"
mkdir -p "$dest"
for name in end czujka; do
  target="$dest/nexora-$name"
  if [[ -e "$target" && ! -L "$target" ]]; then
    echo "error: $target exists and is not a symlink; move it away and run again" >&2
    exit 1
  fi
  ln -sfn "$here/$name" "$target"
  echo "linked $target -> $here/$name"
done
