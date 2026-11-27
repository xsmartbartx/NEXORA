# ADR-0017: Growth Engine delivery boundaries and implementation sequence

- **Status:** Proposed
- **Date:** 2026-11-27
- **Decision owners:** NEXORA Platform
- **Related:** ADR-0014-growth-engine-boundary, docs/growth/marketing-engine.md, docs/growth/growth-engine-delivery-plan.md

## Context

The Growth Engine implementation has moved beyond the original foundation. The repository now includes organisation-scoped campaigns, immutable content versions, version-specific approvals, AI draft generation through the server-side NEXORA AI relay, lead acquisition and touchpoint records, operational analytics, integration metadata contracts, and persistence for workflow runs. The existing Marketing Engine notes contain historical checkpoints and planned phases, so a current implementation plan is needed to distinguish shipped foundations from unimplemented execution.

## Decision

1. Growth remains a first-party module inside the NEXORA Console and follows the Growth boundary in ADR-0014.
2. Existing database tables, migrations, identity, registry, telemetry, AI relay and integration packages must be reused; no parallel Growth data plane is introduced.
3. The next vertical slice is Product Growth Profiles and campaign completeness, followed by content version/evidence UX and immutable reports.
4. Integrations start read-only. Secret retrieval, provider execution, n8n workers and webhook callbacks remain disabled until their security and operational acceptance tests pass.
5. Metrics that depend on external sources or unverified joins remain unavailable rather than being represented as zero or approximated.
6. Publishing, outbound email and pricing modifications remain outside the enabled feature set until separate approval and execution controls pass review.

## Consequences

- Smaller, reviewable changes can be shipped without destabilising platform identity, billing or product registry.
- The system will not expose misleading revenue/CAC/ROAS metrics before source reconciliation exists.
- The roadmap separates provider metadata contracts from live integration capabilities.
- Each slice must include migration, tests, documentation and organisation-isolation verification where relevant.

## Rejected alternatives

- Starting with autonomous social publishing: rejected because identity, evidence, approvals, credentials and retries are not yet enforced at a trusted execution boundary.
- Treating n8n as the system of record: rejected because durable business state and tenancy belong to NEXORA.
- Creating a second marketing CRM/database for all customer identity: rejected because it would duplicate platform boundaries and increase privacy risk.

## Immediate implementation priority

G7.1 Product Growth Profiles: a unique, organisation-scoped profile per Product Registry slug containing ICP, positioning, use cases, evidence references and approved claims. The profile will inform campaigns and AI drafts, but does not override registry lifecycle, pricing or feature metadata.
