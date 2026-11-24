# ADR-0014: Growth Engine as a first-party Console module

- **Status:** Proposed
- **Date:** 2026-11-24
- **Decision owners:** NEXORA Platform
- **Related:** NEXORA Platform Architecture, ADR-0001, ADR-0011

## Context

NEXORA already has shared identity, organisations, Product Registry, billing, telemetry, a Console and a single PostgreSQL access package. A marketing system built as a separate SaaS would duplicate identity, tenant boundaries, product metadata and audit controls. The Growth Engine also needs to coordinate external providers and AI-generated content without granting those systems authority over the platform.

## Decision

1. Growth Engine is an internal, organisation-aware module of the existing NEXORA Console.
2. It uses NEXORA Auth/Clerk for identity and organisation context, existing RBAC conventions, Product Registry for product truth, `@nexora/database` for persistence and platform audit events for security-sensitive mutations.
3. n8n performs asynchronous orchestration only. Growth API persists workflow intent, validates callback events and owns the business state.
4. AI calls go through the NEXORA AI Gateway. Provider credentials remain in a managed secret store.
5. All generated content is a draft. Publishing, email sends and pricing changes require an explicit human approval tied to the exact content version or change proposal.
6. PostHog and other providers are analytics/integration sources, not authoritative identity or billing systems.
7. The initial release is limited to Overview, Products, Campaigns, Content Studio, Approvals, Analytics and Reports.

## Consequences

### Positive
- Reuses existing identity, tenancy, UI shell, API conventions and operational infrastructure.
- Avoids a parallel user/product catalogue and limits operational surface area.
- Makes workflow execution observable and replay-safe.
- Establishes a controlled approval boundary before external side effects.

### Costs and constraints
- Growth schema and APIs must follow existing database and module ownership rules.
- Integration failures must not block the Console or core product flows.
- Provider coverage varies; unsupported publishing actions remain manual.
- Attribution and cross-product identity require explicit privacy and retention design.

## Rejected alternatives

- **Separate Growth SaaS:** rejected because it duplicates platform identity, organisation management and product metadata.
- **n8n as the database/UI:** rejected because workflow engines are not the durable business system of record and do not provide the platform's tenant and audit contracts.
- **Direct AI-provider calls from the browser:** rejected because this leaks credentials and bypasses the governed AI Gateway.
