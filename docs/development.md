# Development

## Set up a machine

```bash
brew bundle        # installs the toolchain from ./Brewfile
npm run doctor     # confirms everything resolved
npm install
npm run dev
```

`npm run doctor` fails (exit 1) only for a missing or unusable required tool,
and warns for the rest. The two non-obvious checks: **npm must be 11** (Node 22
ships npm 10, whose `npm ci` rejects this repo's lockfile) and **Docker's
daemon must be running**, not merely installed.

## Toolchain

| Tool                         | Used for                                           |
| ---------------------------- | -------------------------------------------------- |
| Node 22 + npm 11             | Every app and package (CI and Docker build on 22)  |
| Docker Desktop               | `infrastructure/docker` builds and local stacks    |
| Terraform + `oci`            | `infrastructure/terraform` (provider `oracle/oci`) |
| `gh`                         | PRs, CI status, releases                           |
| `jq`, `curl`, `openssl`      | Scripting and poking at endpoints                  |
| `psql`, DBeaver, `redis-cli` | Inspecting Postgres and Redis                      |
| Postman or Insomnia          | Manual API testing (see below)                     |

Not in the list on purpose: the AWS CLI (hosting is Oracle Cloud), `kubectl`
(no Kubernetes), and Python/FastAPI (Vigilo and NeuraWall are separate repos;
nothing here is Python).

## API tests

`tests/api/` holds a Postman collection for `apps/api` plus a `local` and a
`production` environment. Import them into Postman or Insomnia for manual work,
or run them headless:

```bash
npm run test:api                 # against http://localhost:3004
npm run test:api -- production   # against https://api.onenexora.com
API_KEY=nx_live_... npm run test:api -- production   # also the authenticated folder
```

| Folder            | Needs                                             |
| ----------------- | ------------------------------------------------- |
| 1. Public         | nothing                                           |
| 2. Auth rejection | nothing — no key, no database                     |
| 3. Invalid key    | a database-backed API (`production` runs it)      |
| 4. Authenticated  | a real key, via `API_KEY` / the `apiKey` variable |

Only the endpoints that exist are covered: `GET /v1/health`,
`GET /v1/products` and `GET /v1/products/{slug}`. The Clerk and Stripe webhooks
are signature-verified and are covered by unit tests, not here.

In CI, `.github/workflows/api-tests.yml` builds the API image on every pull
request and runs folders 1 and 2 against it. Running it manually
(**Actions → API tests → Run workflow**) also tests production; add a
`NEXORA_API_KEY` repository secret and that run covers folder 4 as well.
