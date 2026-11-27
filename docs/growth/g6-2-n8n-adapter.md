# Growth Engine G6.2 — n8n Adapter

**Status:** typed adapter and configuration validation; no network execution.

## Delivered

- A trusted-code `createN8nAdapter()` implementation for the shared integration contract.
- Required n8n instance URL and opaque secret-manager reference.
- HTTPS required for non-loopback hosts; plain HTTP is accepted only for local development.
- URL validation rejects embedded credentials, query strings and fragments.
- Unknown configuration fields are rejected, preventing API keys from being passed through the adapter configuration object.
- Tests cover valid configuration, normalization, malformed URLs, local development, credential-reference validation and non-disclosure of input values.

## Runtime boundary

This adapter does not make HTTP requests, read secrets, test connectivity, trigger workflows, register webhooks or execute provider actions. The `credentialRef` is an opaque pointer only; the actual n8n API key must be resolved by a trusted server-side secret-manager integration in a later slice.

## Requirements before enabling outbound calls

1. Resolve the secret reference only in a trusted worker; never accept the API key from a browser request.
2. Restrict egress to approved n8n endpoints, defend against DNS rebinding and private-network SSRF, and disable redirects or revalidate every redirect target.
3. Send the API key only in the provider's expected authentication header over TLS.
4. Apply tenant ownership, capability, consent and approval checks before workflow execution.
5. Use idempotency controls and persist sanitized status/error codes without storing provider secrets or raw response bodies.
6. Keep workflow execution disabled until worker, audit, retries and human approval checks are implemented and reviewed.
