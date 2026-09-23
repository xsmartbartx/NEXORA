# Docker

Every app in `apps/*` builds from the single [`Dockerfile`](Dockerfile) in
this directory, parameterised by `APP_NAME`. [`docker-compose.yml`](docker-compose.yml)
wires all 10 together with Postgres for local use. Both are verified —
see "What's been verified" below, not just written and assumed correct.

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

## Build-time vs. runtime env — the one real gotcha

Next.js bakes every `NEXT_PUBLIC_*` variable into the JavaScript bundle at
`next build` time. The Dockerfile's builder stage runs `next build` with
no `NEXT_PUBLIC_*` build args passed, so each app falls back to whatever
default is hardcoded in its source (e.g.
`process.env.NEXT_PUBLIC_CONSOLE_URL ?? "http://localhost:3002"`) — which
happens to be exactly right for `docker-compose.yml`'s all-on-one-machine
topology, but **will be wrong for a real multi-host deploy** where
`console.onenexora.com` isn't `localhost:3002` anymore. For that, add
`ARG`/`ENV` lines for the specific `NEXT_PUBLIC_*` values each app needs
before its `RUN npm run build` line, and pass them as `--build-arg` — the
Dockerfile doesn't do this today because there's no real domain yet to
bake in (see the root README's "Before this goes live").

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

## What this is not

A production deployment manifest. No orchestrator (no Kubernetes/ECS/etc
config), no secrets manager, no horizontal scaling, no TLS termination,
one Postgres instance for everything with no backup policy, and
`packages/api-kit`'s rate limiter is in-memory (per-instance — see its own
file comment) so it needs a shared store (Redis/Upstash) before running
more than one replica of `api` or `gateway`. This gets you a real,
verified container per app and a real, verified way to run them together
locally; where you actually deploy them (a VPS, a managed container
platform, ...) is a separate decision the root README flags as still
open.
