# Growth Engine G6.1 — Integration Core

**Status:** provider-neutral contracts and metadata catalog; no provider execution.

## Delivered

- `@nexora/integrations`: typed provider definitions and adapter contract.
- Static catalog aligned with the database provider allow-list.
- Explicit adapter registry; only adapters registered by trusted server code can be resolved.
- Stable sanitized error codes; arbitrary exception messages and provider payloads are discarded.
- Unit tests for catalog parity, duplicate registration, registry lookup and error sanitization.

## Architectural boundary

The catalog describes supported provider families and broad capability classes. It does not mean an account is connected, credentials exist, scopes have been granted, or a capability is enabled for a tenant. Provider-specific OAuth scopes and API-key permissions are deliberately resolved by adapters rather than guessed in shared metadata.

The registry is inert unless server code supplies an adapter. It does not dynamically import modules, perform network requests, exchange OAuth codes, read secrets, process webhooks or execute workflows.

## Security requirements for future adapters

1. Accept configuration only through provider-specific validation; never accept credentials from browser-controlled payloads.
2. Resolve opaque `credential_ref` values only through the deployment secret manager in trusted server runtime.
3. Never persist or log access tokens, refresh tokens, API keys, OAuth responses, webhook secrets, raw provider payloads or raw exception messages.
4. Request least-privilege permissions and verify actual granted scopes before using a capability.
5. Enforce tenant ownership, approval state, consent and suppression checks at the execution boundary.
6. Treat provider webhooks as untrusted input: verify signatures, enforce replay protection and validate schemas.
7. Keep outbound actions disabled until the adapter, worker, audit trail and human approval flow pass review.

## Not included

OAuth lifecycle, secret-manager integration, provider HTTP clients, webhook routes, background execution, CRM synchronization, email delivery and social publishing remain follow-up slices. This package enables no external side effect.
