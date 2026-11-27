# Growth Engine G6 — integration and workflow foundation

**Status:** persistence contract implemented; provider execution intentionally not enabled.

## Scope

G6 starts with a durable, tenant-scoped integration registry and workflow execution ledger. It does not connect provider accounts, store OAuth tokens, run n8n jobs, publish content or send marketing messages.

## Integration registry

`growth_integrations` stores the organisation, provider and connection key; display label and lifecycle status; optional external account identifier and granted scopes; an opaque `credential_ref` pointing to a managed secret store; connection/verification timestamps; and a sanitised error code.

The database must never contain access tokens, refresh tokens, client secrets, webhook signing secrets or raw OAuth responses. The application layer must resolve `credential_ref` through the deployment's secret manager and must never return it to browser clients.

## Workflow execution ledger

`growth_workflow_runs` records workflow intent and execution state: tenant-scoped idempotency key, workflow key and trigger type, lifecycle state, bounded attempt count, next eligible execution time, integration reference, external run identifier, and optional approval plus exact content-version references.

When `requires_approval` is true, both `approval_id` and `content_version_id` are mandatory. Before executing an external side effect, a future worker must re-read the approval under the same organisation, verify that it is approved for the exact content version, and verify that the content version is still eligible for that action. The database check is a structural guard, not a substitute for runtime authorisation.

## Required worker contract

1. Claim queued work atomically (for example with `FOR UPDATE SKIP LOCKED`) and transition it to running.
2. Re-check organisation ownership for the run, integration, approval and content version.
3. Resolve the secret reference server-side; never log credential material.
4. Enforce provider scopes, rate limits, request timeouts and provider-specific idempotency.
5. Retry only transient failures with bounded exponential backoff and jitter.
6. Move exhausted work to `dead_letter`; retain a sanitised error code, not provider payloads or PII.
7. Record completion and audit metadata. Do not mark a run successful before the provider confirms the operation.
8. For outbound email and publishing, require explicit approval of the exact content version and re-check consent/suppression immediately before dispatch.

## Operational boundary

The migration is `0012_growth_integrations_workflows.sql`. Apply it through the normal database migration process before any future integration service uses these tables. Provider credentials, OAuth callback routes, webhook ingestion, background workers, CRM sync, email delivery and social publishing remain separate follow-up slices.
