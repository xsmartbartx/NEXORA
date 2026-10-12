# Guardians G1: a deterministic gate for agent tool calls

`claude-guard.mjs` is a Claude Code `PreToolUse` hook. It runs before every Bash command and every file Read, Edit or Write and answers with code, not with a model:

| decision | effect                                                            |
| -------- | ----------------------------------------------------------------- |
| `deny`   | blocked (exit code 2); the reason is shown to the agent           |
| `ask`    | a human must approve this one call, even if an allow-rule matches |
| `allow`  | silent                                                            |

It fails closed: unreadable input or an internal error is a `deny`. Every `deny` and `ask` is appended to `~/.claude/logs/nexora-guard.jsonl` (commands are truncated and secret-shaped values are masked).

## What it covers

- **Secrets:** reading, copying or printing `.env*` files, private keys, cloud credentials and Claude session transcripts; environment dumps (`env`, `printenv`, `docker inspect` of the environment, a process's `environ` file); secret-shaped values typed into a command. Writing a secret file asks.
- **Irreversible git:** force pushes, deleting remote refs, `reset --hard`, `clean -f`, discarding the working tree, `branch -D`, history rewrites. Pushing to `main` or `master` (also a bare `git push` while on one) is denied.
- **Filesystem, Docker, SQL:** `rm -r` outside known build directories asks (dangerous targets are denied); volume removal and `compose down -v` are denied, other prunes ask; `DROP`, `TRUNCATE` and `DELETE` without `WHERE` are denied (asked when the database is on localhost).
- **Production host and security settings:** anything that changes the host over `ssh`, `scp` or `rsync`, `terraform apply`, cloud IAM changes, and GitHub calls that touch protection, secrets, keys, hooks or repository settings ask. Repository deletion and printing the GitHub token are denied.

Heredoc bodies and quoted messages are data, not commands, so documentation text does not trigger rules (a heredoc fed to a shell is still inspected, and secret-shaped values are checked everywhere).

The rules and their regression tests live in `claude-guard.test.ts`: cases taken from real agent history that reached secrets, plus everyday commands that must keep working.

## Install

```bash
mkdir -p ~/.claude/hooks
cp ops/guardians/claude-guard.mjs ~/.claude/hooks/nexora-guard.mjs
```

Then merge `settings.example.json` into `~/.claude/settings.json` (use the full path of your `node` binary if `node` is not on the hook's PATH). Remove `skipDangerousModePermissionPrompt` if it is set. The guard asks before anything edits its own configuration.

## Limits (read this)

G1 inspects the text of a command or the path of a file. It does **not** see what a script does once it runs: `python3 -c`, `node -e` or a heredoc piped to an interpreter can read a secret without the guard noticing. G1 stops accidents and the obvious paths; it is not a security boundary against a compromised agent. The boundary is the next layers: a host user without `sudo` behind a forced command (G2), and branch protection with required reviews plus a non-admin bot identity (G3).
