# Guardians G2: the agent's door into the production host

`nexora-guard.mjs` is the **only** thing the agent's SSH key can run. sshd executes it instead of
whatever the client asks for; it checks the request against a closed list, asks a human for
approval where a change is hard to undo, logs every call, and supports `--dry-run`.

| request over SSH                               | tier | approval           | runs                                       |
| ---------------------------------------------- | ---- | ------------------ | ------------------------------------------ |
| `audit ports\|disk\|containers\|sshd\|backups` | T0   | no                 | one fixed read-only command                |
| `deploy <project> <service...>`                | T2   | no                 | `deploy.sh` as `opc` (host lock, as today) |
| `deploy nexora ... db-migrate`                 | T2   | **yes**            | same                                       |
| `deploy edge`                                  | T2   | **yes**            | same                                       |
| `restore-drill`                                | T2   | no                 | `restore-drill.sh` as `opc`                |
| anything else                                  |      | refused (exit 126) |                                            |

No shell is involved: the request may contain only letters, digits and `. / : @ = , -`, is
split on spaces and runs through `execFile`. Services are checked against a list for NEXORA.

**Approvals** are made by a person on the host, never over the agent's key:
`node /opt/nexora/ops/guardians/host/nexora-guard.mjs approve "deploy nexora db-migrate" 600`.
An approval covers that exact command, expires (default 10 minutes, at most 1 hour) and works once.
The agent user can read approvals but not write them.

## What this does not do

It is not a sandbox. It narrows what the key can ask for; the account around it makes that hold.
Without the steps below the key is just a key. Nothing here is applied until a person does it.

## Turning it on (production, in this order; each step needs a person)

1. **Create the user, no sudo, no password:** `sudo useradd -m -s /bin/bash nexora-agent`. It must
   not be in `docker`, `sudo` or `wheel`.
2. **Directories:** `/opt/nexora/guard/approvals` owned by `opc`, group `nexora-agent`, mode `750`
   (agent reads, cannot write); `/opt/nexora/guard/approvals/used.log` and `/var/log/nexora-guard.jsonl`
   writable by the agent only.
3. **Sudoers, exact paths only** (`/etc/sudoers.d/nexora-agent`, check with `visudo -c`):
   ```
   nexora-agent ALL=(opc) NOPASSWD: /opt/nexora/infrastructure/deployment/deploy.sh, /opt/nexora/infrastructure/deployment/restore-drill.sh
   nexora-agent ALL=(root) NOPASSWD: /usr/sbin/sshd -T, /usr/bin/docker ps --format *
   ```
   The `docker ps` wildcard is safe only because the guard builds that command itself; drop the
   audits that need it if you prefer no wildcard.
4. **The key:** a new key pair for the agent (you generate it; the private half never enters a
   repository or a chat). In `/home/nexora-agent/.ssh/authorized_keys`:
   ```
   restrict,command="/usr/bin/node /opt/nexora/ops/guardians/host/nexora-guard.mjs" ssh-ed25519 AAAA... agent
   ```
   `restrict` turns off port, agent and X11 forwarding and the pty.
5. **Prove it before use:** from a second session, `ssh nexora-agent@host "audit ports"` works;
   `ssh nexora-agent@host "id"` and `ssh nexora-agent@host "deploy nexora db-migrate"` are refused; a
   plain login shell is not offered. Check `/var/log/nexora-guard.jsonl`.
6. **SSH exposure (your decision, separate change):** limit port 22 to fixed addresses or an OCI
   bastion in the OCI security list (Terraform), and add fail2ban. Do this last and keep a second
   session open while you do.

## Log

Each call appends one JSON line: `refused`, `dry-run`, `approved`, `exec`, `done` with time,
source address and the normalised command. Shipping it into `audit_events` comes with the Cloud
Worker; until then the file is the record.
