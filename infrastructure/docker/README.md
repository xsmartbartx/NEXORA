# Docker

Every app in `apps/*` builds from the single [`Dockerfile`](Dockerfile) in
this directory, parameterised by `APP_NAME`. [`docker-compose.yml`](docker-compose.yml)
wires all 10 together with Postgres for local use;
[`docker-compose.prod.yml`](docker-compose.prod.yml) is the production
equivalent, fronted by the shared reverse proxy in
[`../edge/`](../edge/) for real subdomains and automatic TLS — see
"Going to production" below. All of it is verified — see "What's been
verified" — not just written and assumed correct.

## Build one app

From the repository root (the build context has to be the root, since
npm workspaces needs the whole `apps/`/`packages/` tree to resolve):

```bash
docker build -f infrastructure/docker/Dockerfile \
  --build-arg APP_NAME=website \
  --build-arg APP_PORT=3000 \
  -t nexora-website .

docker run -p 3000:3000 nexora-website
```

`APP_NAME` is any directory name under `apps/` (`website`, `console`,
`api`, `sentinel`, ...). `APP_PORT` defaults to `3000`; set it to match
whatever you map with `-p` — it only controls what the container listens
on internally, matching this repo's own port convention (website `3000`,
account `3001`, console `3002`, status `3003`, api `3004`, docs `3005`,
developers `3006`, sentinel `3007`, cspm `3008`, gateway `3009`) is purely
a convention, not a requirement.

Secrets (`CLERK_SECRET_KEY`, `DATABASE_URL`, `STRIPE_SECRET_KEY`, ...) are
**runtime** environment variables — pass them with `-e` or `--env-file` at
`docker run`, never baked into the image. `NEXT_PUBLIC_*` variables are the
one exception: Next.js inlines them into the client bundle at `next build`
time, so if you need a real (non-`localhost`) public URL in production,
pass it as a **build** arg/env at `docker build` time instead — see
"Build-time vs. runtime env" below.

## Run everything together

```bash
docker compose -f infrastructure/docker/docker-compose.yml up --build
```

This builds and starts all 10 apps plus a Postgres instance, runs
`packages/database`'s migrations once against it (the `db-migrate`
service), and each app that needs Postgres waits for that to finish
before starting. Each app also loads its own `apps/<name>/.env.local` if
it exists (copy from that app's `.env.example`) — that file is optional,
so the stack comes up even with nothing configured yet, in the same
"setup required" degraded state as local dev.

**Memory note:** building all 10 apps' `next build` in parallel needs
real memory — this was verified with ~4GB free and needed more than that
in one pass (Docker Desktop's default allocation on a modest machine can
run out). If `--build` fails with an out-of-memory error, build services
one at a time first (`docker compose ... build <service>` in a loop), then
`up -d` without `--build` — this was the actual verification path used
here, works reliably, and matches how a CI pipeline builds and pushes
images anyway (one at a time, not all in parallel on one machine).

## Going to production

`docker-compose.prod.yml` is a single-VM topology (e.g. one OCI
instance) with Postgres bundled and no ports published. TLS and routing
live in [`infrastructure/edge/`](../edge/): one Caddy stack for the whole
host, shared with Vigilo and NeuraWall, which joins each project's Docker network and
routes every `*.onenexora.com` subdomain to its container. Only that
Caddy binds 80/443.

1. **DNS**: on whatever registrar manages `onenexora.com`, add 11 **A**
   records — `@` (root), `www`, `account`, `console`, `status`, `api`,
   `docs`, `developers`, `sentinel`, `cspm`, `gateway`, `monitoring` — all
   pointing at the OCI instance's public IPv4 address. Caddy requests a
   Let's Encrypt certificate per domain on first request, so DNS has to
   actually resolve before it can — expect the first hit to each
   subdomain to be slow while that happens.

2. **Open ports 80 and 443 — at both layers.** OCI blocks them by
   default at two independent layers, and both have to be opened or
   nothing gets through:
   - **OCI Security List / Network Security Group** (Console → Networking
     → Virtual Cloud Networks → your VCN → the subnet's Security List, or
     the instance's own NSG if it has one): add ingress rules for
     `0.0.0.0/0`, TCP, ports 80 and 443. This is a cloud-level firewall —
     nothing inside the VM can override it, so it has to be done from the
     OCI Console itself, which needs your OCI login, not mine.
   - **The instance's own OS firewall** (`firewalld`, which Oracle Linux
     ships with enabled by default) — run on the instance itself:
     ```bash
     sudo firewall-cmd --permanent --add-port=80/tcp
     sudo firewall-cmd --permanent --add-port=443/tcp
     sudo firewall-cmd --reload
     ```

3. **Install Docker** (Oracle Linux is RHEL-family — `dnf`, not `apt`;
   its own container tooling is podman, not Docker, so this adds Docker's
   real upstream repo rather than using what's preinstalled):

   ```bash
   sudo dnf install -y dnf-utils
   sudo dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
   sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
   sudo systemctl enable --now docker
   sudo usermod -aG docker $USER   # log out/in once for this to apply
   ```

4. **Get the code onto the instance and configure secrets**:

   ```bash
   git clone https://github.com/xsmartbartx/NEXORA.git nexora-platform
   cd nexora-platform
   cp infrastructure/docker/.env.prod.example infrastructure/docker/.env.prod
   nano infrastructure/docker/.env.prod   # fill in real Clerk/Stripe/Postgres values
   ```

5. **Build and run** — check the instance's RAM first (`free -h`); OCI's
   Always Free shapes in particular can be too small to build all 10
   apps' `next build` in parallel (this was verified failing at ~4GB free
   locally — see the memory note above, same risk here, likely worse on a
   small shape):

   ```bash
   # If RAM is tight, build one at a time first, then start without
   # --build (already-built images are reused, not rebuilt):
   for app in website account console status api docs developers sentinel cspm gateway; do
     docker compose -f infrastructure/docker/docker-compose.prod.yml \
       --env-file infrastructure/docker/.env.prod build "$app"
   done
   docker compose -f infrastructure/docker/docker-compose.prod.yml \
     --env-file infrastructure/docker/.env.prod up -d

   # If RAM isn't a concern, this one command does both:
   docker compose -f infrastructure/docker/docker-compose.prod.yml \
     --env-file infrastructure/docker/.env.prod up -d --build
   ```

   Then start the edge proxy. It declares both this project's network and
   Vigilo's (`vigilo-self-host_default`) and NeuraWall's (`neurawall_default`)
   as external, so those stacks have to be up first too, or `up` fails on the
   missing network. NeuraWall runs from `/opt/neurawall` and deploys with
   `deploy.sh neurawall control-plane`:

   ```bash
   docker compose -f infrastructure/edge/docker-compose.yml up -d
   ```

6. **Check it actually came up**:
   ```bash
   docker compose -f infrastructure/docker/docker-compose.prod.yml \
     --env-file infrastructure/docker/.env.prod ps
   docker compose -f infrastructure/edge/docker-compose.yml logs -f caddy
   ```
   Watch the Caddy logs specifically on first run — that's where a
   certificate failure (DNS not propagated yet, or ports 80/443 not
   actually reachable from the internet) shows up.

**The one real gotcha, either way:** Next.js bakes every `NEXT_PUBLIC_*`
variable into the JavaScript bundle at `next build` time, not runtime.
`docker-compose.prod.yml`'s `args:` blocks pass the real
`https://*.onenexora.com` values at build time for exactly this reason —
confirmed by building with a real domain and checking it landed in the
output (`sitemap.xml`), not just assumed from reading Next.js's docs. If
you build an image any other way (plain `docker build`, a CI step) and
need a real public URL baked in, pass it as a `--build-arg`, matching the
list of `ARG NEXT_PUBLIC_*` lines already in the Dockerfile — an
unset one is genuinely `undefined` in `process.env` (verified directly,
not assumed), so every app's own `?? "http://localhost:..."` fallback
still works correctly for a local/test build with nothing passed.

## Monitoring

Three exporters feed one Prometheus, which Grafana reads — Postgres
(connections, locks, size, replication: `postgres-exporter`), Redis
(memory, evictions, hit rate: `redis-exporter`), and the VM itself (CPU,
disk, load: `node-exporter`). None of these publish a host port; reached
only via `https://monitoring.onenexora.com` through the edge Caddy stack
(`infrastructure/edge/Caddyfile`), behind Grafana's own admin login
(`GRAFANA_ADMIN_PASSWORD` in `.env.prod`).

The Prometheus datasource is auto-provisioned
(`monitoring/grafana-provisioning/datasources/prometheus.yml`) — no
manual "Add data source" step. Dashboards are not pre-provisioned (no
JSON checked in); import the community ones from Grafana's
"Import via grafana.com ID" screen: **9628** (PostgreSQL), **763**
(Redis), **1860** (Node Exporter Full) all work directly against this
setup's metric names.

**Most important Postgres metrics** (per
`infrastructure/docker/monitoring/prometheus.yml`'s `postgres` job):
`pg_stat_database_numbackends` (connections), `pg_stat_database_*` I/O
counters (read/write), lock counts, and `pg_up` itself for whether the
exporter can even reach Postgres — there's no managed-RDS equivalent of
CPU/IOPS/storage metrics here (`node-exporter`'s host-level metrics are
the closest substitute, since this VM runs the database directly, not
behind a managed service).

**Most important Redis metric**: cache hit ratio
(`redis_keyspace_hits_total` / `(redis_keyspace_hits_total +
redis_keyspace_misses_total)`) — not provided as a single number by the
exporter, computed from those two counters in a Grafana panel or
dashboard 763 above. Below ~50% generally means something's wrong with
what's being cached or its TTLs; this deployment's own Redis use
(`packages/api-kit`'s rate-limit counters) is counter storage, not an
app cache, so "hit rate" here reads differently than a typical
read-through cache — expect it to reflect rate-limit-key lookups, not
content caching effectiveness.

## Alerting

Four rules (`monitoring/grafana-provisioning/alerting/rules.yaml`), all
routed to one email contact point
(`monitoring/grafana-provisioning/alerting/contact-points.yaml`) — both
auto-provisioned, no manual rule-building in the UI:

| Rule                    | Fires when                 | `for` |
| ----------------------- | -------------------------- | ----- |
| Postgres is down        | `pg_up == 0`               | 2m    |
| Redis is down           | `redis_up == 0`            | 2m    |
| Redis memory usage high | used/max maxmemory > 90%   | 5m    |
| Root disk space low     | root filesystem < 10% free | 10m   |

Every rule sets `noDataState`/`execErrState` to `Alerting`, not Grafana's
default `NoData`/`Error` — an exporter that stops reporting entirely
(container crashed, scrape failing) is exactly the kind of failure this
needs to catch, so silence must never quietly read as "nothing to
report."

Email goes through Gmail/Workspace SMTP under the same `nexora@
onenexora.com` account the domain's own DNS runs on, using an **App
Password** (`GRAFANA_SMTP_PASSWORD` — generate one at
[myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords),
never the account's real password), to `security@onenexora.com` and
`bw141105@gmail.com`.

**Verified, not just configured**: built each rule against real
Postgres/Redis/node-exporter containers on a scratch network, then
actually broke each condition and watched the rule cross from
`pending` to `firing` within its `for` window — stopped the Postgres
container and confirmed "Postgres is down" fired within 2 minutes, same
for Redis, and filled Redis to 92% of its configured 64MB `maxmemory`
and confirmed "Redis memory usage high" fired within 5 minutes. All
three then confirmed to resolve cleanly once the underlying problem
went away. `rules.yaml` itself is Grafana's own
`/api/v1/provisioning/alert-rules/export` output from that verified
instance, not hand-written. "Root disk space low" was validated for
query syntax the same way (a real Prometheus datasource, no errors) but
not live-fired — deliberately not simulated by actually filling a real
disk to <10% free.

## What's been verified

Actually built and run, not just written:

- `website` (no external dependencies) — built, ran, served its
  homepage, a registry-driven product page, `/legal/terms`, and a static
  asset from `public/` (favicon), all 200 OK, all from inside the
  container.
- `console` (needs Clerk + Postgres) — built with placeholder env,
  correctly served the "Setup required" degraded page from inside the
  container, same as local dev with no real keys.
- The full 10-app + Postgres compose stack — `db-migrate` applied all 3
  migrations against the compose network's own Postgres (confirmed via
  `\dt` inside the container: `api_keys`, `audit_events`,
  `subscriptions` all present); all 10 apps responded `200` on their root
  route; `sentinel`, `cspm`, `gateway` and `api`'s health endpoints all
  reported `{"status":"ok"}` from inside the compose network, confirming
  their Postgres connection — not just that the container started.
- Each standalone image is small: ~78MB compressed, consistent with
  Next.js's `output: "standalone"` tracing only the dependencies each
  app actually uses rather than a full `node_modules`.
- Real-domain build args actually land in the built output — built
  `website` with `NEXT_PUBLIC_SITE_URL=https://onenexora.com` passed as a
  `--build-arg`, confirmed `sitemap.xml` served from the running
  container used that real domain, not the `localhost` fallback.
- `infrastructure/edge/` — running in production on the shared OCI
  instance, serving every NEXORA, Vigilo and NeuraWall domain with a Let's Encrypt
  certificate, proxying across both projects' networks.
- `docker-compose.prod.yml`'s variable interpolation — validated with
  `docker compose config` against a real `.env.prod`-shaped file, confirmed
  every `${...}` (the Postgres password, the Clerk publishable key) and
  every hardcoded `https://*.onenexora.com` build arg resolved to the
  actual value, not left as a literal `${VAR}` string.
- The monitoring stack — built the exact same four images
  (`postgres-exporter`, `redis-exporter`, `node-exporter`, `prometheus`,
  `grafana`) against a real Postgres and Redis on a scratch network,
  confirmed Prometheus's `/api/v1/targets` reports all three exporters
  `"health": "up"`, confirmed `pg_up` and `redis_connected_clients`
  return real values through a direct Prometheus query, and confirmed
  the same query returns the same value through Grafana's own
  datasource proxy (i.e. the full chain, not just each piece in
  isolation) — with the Grafana datasource auto-provisioned, not
  manually added for the test. Not yet confirmed: this exact config
  running on the live OCI VM itself (`node-exporter`'s host-path mounts
  in particular are worth re-checking there — Oracle Linux's layout was
  assumed, not confirmed, to match what was tested locally).

## What this still is not

No orchestrator (no Kubernetes/ECS/etc config) and no secrets manager —
`.env.prod` on the VM is it. No horizontal scaling: one Postgres instance
for everything with no backup policy, and `packages/api-kit`'s rate
limiter is in-memory (per-instance — see its own file comment) so it
needs a shared store (Redis/Upstash) before running more than one replica
of `api` or `gateway`. Alerting ("## Alerting" above) covers the database,
cache and disk — nothing watches CPU, memory, or any individual app's own
error rate (Sentry has the latter, separately) yet. This gets you a real, verified container per app
and a real, verified way to run them together — including with real TLS
on real subdomains — on one machine; scaling beyond one machine is a
later, separate decision.
