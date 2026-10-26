# Rebuilding the platform from nothing

For the day the server, or the whole OCI account, is gone. Written from what exists in this
repository; **it has not been rehearsed end to end**, so the first rehearsal should record the real
times in the table at the bottom and correct anything that turned out wrong.

## What survives, and where

| thing                                                           | where it lives                                                      | survives losing the VM? | survives losing the OCI account? |
| --------------------------------------------------------------- | ------------------------------------------------------------------- | ----------------------- | -------------------------------- |
| code                                                            | GitHub (`NEXORA`, Vigilo, NeuraWall repos)                          | yes                     | yes                              |
| nightly backup (3 Postgres dumps, NeuraWall data, Vigilo MinIO) | host `/opt/backups/archives` (14 days)                              | no                      | no                               |
| off-site copy 1                                                 | OCI bucket `nexora-backups` (expires after `backup_retention_days`) | yes                     | **no**                           |
| off-site copy 2                                                 | other provider, encrypted (`offsite-copy.sh`)                       | yes                     | yes, needs the private GPG key   |
| secrets (`.env.prod`, Vigilo and NeuraWall env)                 | the host only                                                       | no                      | no                               |
| infrastructure definition                                       | `infrastructure/terraform`                                          | yes                     | yes                              |

**Secrets are the gap.** The environment files exist only on the host. Keep a copy of each in your
password manager; without them a restored database still cannot run the platform (Stripe, Clerk, webhook
secrets, the NeuraWall signing key inside its data volume backup).

## Steps

1. **Server.** `infrastructure/terraform`: for a new tenancy, `terraform apply` creates the network, the
   instance, the backup bucket with its expiry rule, and the dynamic group and policy that let the host
   write to it. The dynamic group matches the instance OCID, so it follows the new instance
   automatically; if you created an instance by hand, update that rule or uploads fail with a misleading
   `BucketNotFound`. A1 capacity in Frankfurt can be unavailable: retry another availability domain, or
   use the Hetzner fallback below.
2. **Packages on the host** (not yet scripted): Docker with the compose plugin, git, `nodejs:22`
   (`dnf module enable nodejs:22 && dnf install nodejs`, needed by the worker), the OCI CLI, `gpg`,
   `rclone`. Create `/opt/nexora` (owned by `opc`), `/opt/backups`, `/opt/vigilo`, `/opt/neurawall`, and
   clone the three repositories. Vigilo's remote must point at the Vigilo repository, not NEXORA.
3. **Secrets.** Put the environment files back from the password manager (mode 600). Do not commit them.
4. **Data.** Fetch the newest archive:
   - from OCI: `oci os object get --auth instance_principal --bucket-name nexora-backups --name platform/<archive> --file <archive>`
   - or from the second copy: download the `.gpg` file, then `gpg --decrypt` it on **your own machine**
     with the private key (the host never had it), and copy the archive over.

   `infrastructure/deployment/restore-drill.sh` shows the exact restore of the NEXORA database into a
   throwaway container; for production, start the stack's Postgres, then `pg_restore` each dump into
   its database (`nexora`, `vigilo`, `neurawall`), and untar the NeuraWall data and Vigilo MinIO
   volumes into their Docker volumes.

5. **Start.** `infrastructure/deployment/deploy.sh nexora db-migrate website account console api gateway docs developers status sentinel cspm`,
   then the Vigilo and NeuraWall stacks, then `deploy.sh edge`.
6. **DNS.** Point the `A` records at the new public IP (lower the TTL beforehand if you know a move is
   coming). Caddy obtains certificates on its own once DNS resolves.
7. **Crons and jobs.** Install the crontab entries documented in `docs/ops/notification-hub.md`,
   `ops/worker/README.md`, the nightly `backup-all.sh` and `offsite-copy.sh`.
8. **Verify.** Public endpoints answer, `status.onenexora.com/api/backup` is 200 after the first backup,
   `node ops/worker/worker.mjs status` shows the jobs, and a Hub tick returns `"ran":true`.

## Moving to Hetzner Cloud instead

Images are built on the host, so they build on any arm64 or x86 Linux machine. The same steps apply
from step 2 with a Hetzner server in place of the OCI instance (an ARM `CAX31`, 8 vCPU and 16 GB, keeps
the arm64 images identical). Nothing in the application code is OCI-specific except the backup upload,
which uses OCI instance principals: on another provider use `offsite-copy.sh` (rclone) as the primary.

## What is not independent yet

`status.onenexora.com` is served by this same host, so it goes down with it. The uptime workflow
(GitHub Actions) is external. A standalone status page on a separate small machine is still to be built.

## Rehearsal log

| date | from | to  | time to a working platform | what broke |
| ---- | ---- | --- | -------------------------- | ---------- |
|      |      |     |                            |            |
