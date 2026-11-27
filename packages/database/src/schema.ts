import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Machine identity (§6.4). `orgId`/`createdBy` are Clerk ids (`org_...`,
 * `user_...`) — foreign keys by convention, not a DB constraint, since the
 * users/organisations tables themselves live in Clerk, not here (§13.1).
 * Only `keyHash` and `keyPrefix` are ever stored; the plaintext key is
 * generated, shown once, and never persisted.
 */
export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id").notNull(),
    name: text("name").notNull(),
    keyPrefix: text("key_prefix").notNull(),
    keyHash: text("key_hash").notNull(),
    scopes: text("scopes").array().notNull().default([]),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    // Every API/Gateway request looks a key up by hash.
    uniqueIndex("api_keys_key_hash_idx").on(table.keyHash),
    index("api_keys_org_id_idx").on(table.orgId),
  ],
);

/**
 * The Telemetry / audit log of §4.1 and §12.4: actor, org, action, resource,
 * outcome, timestamp — never the secret or payload that triggered it.
 */
export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id"),
    actorId: text("actor_id").notNull(),
    action: text("action").notNull(),
    resourceType: text("resource_type"),
    resourceId: text("resource_id"),
    outcome: text("outcome").notNull().default("success"),
    metadata: jsonb("metadata"),
    /**
     * The sender's own id for an event reported over the API (`POST /v1/events`),
     * so a retry after a timeout is stored once. Null for events NEXORA writes
     * itself. Unique per organisation; Postgres treats nulls as distinct, so
     * the many existing rows are unaffected.
     */
    externalId: text("external_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  // Usage, Analytics and entitlement counts filter by org + action over a time window.
  (table) => [
    index("audit_events_org_action_created_idx").on(table.orgId, table.action, table.createdAt),
    uniqueIndex("audit_events_org_external_id_idx").on(table.orgId, table.externalId),
    check("audit_events_outcome_chk", sql`${table.outcome} in ('success', 'failure')`),
  ],
);

/**
 * One row per (organisation, product) — Sentinel, CSPM and Gateway are
 * billed and tiered independently (packages/billing/src/plans.ts), so an
 * org can be Pro on one and Free on another. Mirrors Stripe's subscription
 * resource (§4.1 Billing: "feeds Entitlements — never deciding access
 * directly"). This table is the read model Entitlements checks against;
 * Stripe's webhooks (packages/billing) are the only writer. No row for a
 * given product means that product is on its default (free) plan.
 */
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id").notNull(),
    product: text("product").notNull(),
    planId: text("plan_id").notNull(),
    status: text("status").notNull(),
    stripeSubscriptionId: text("stripe_subscription_id").notNull().unique(),
    stripeCustomerId: text("stripe_customer_id").notNull(),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("subscriptions_org_product_idx").on(table.orgId, table.product)],
);

/**
 * NEXORA-staff control, not a customer-facing setting (§4.1 Entitlements
 * still owns plan limits; this is a second, independent gate ahead of
 * those — a plan limit says "how much", this says "at all"). Presence of a
 * row for `(orgId, product)` means that product is suspended for that
 * organisation, regardless of plan; absence means normal, plan-governed
 * access. Un-suspending deletes the row rather than flipping a status
 * column — there is nothing to represent between "suspended" and "not" for
 * a given product, and the history of who suspended/resumed it and why
 * already lives in `audit_events` (logged by the admin package itself).
 */
export const productSuspensions = pgTable(
  "product_suspensions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id").notNull(),
    product: text("product").notNull(),
    reason: text("reason").notNull(),
    suspendedBy: text("suspended_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("product_suspensions_org_product_idx").on(table.orgId, table.product)],
);

/**
 * What the platform costs to run, entered by hand in the Control Center —
 * there is no billing API worth wiring up for a handful of vendors (the
 * Oracle Cloud host, domains, Workspace, ...). Amounts are US cents per
 * `interval`. A cost that stops is ended (`endedAt`), not deleted, so
 * past months stay explainable.
 */
export const opsCosts = pgTable(
  "ops_costs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    vendor: text("vendor").notNull(),
    label: text("label").notNull().default(""),
    amountCents: integer("amount_cents").notNull(),
    interval: text("interval").notNull(),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
  },
  (table) => [
    check("ops_costs_interval_chk", sql`${table.interval} in ('month', 'year')`),
    check("ops_costs_amount_chk", sql`${table.amountCents} >= 0`),
  ],
);

/**
 * One row each time the owner ticks off a recurring operational task
 * (daily/weekly/monthly review). Task definitions live in code
 * (packages/admin); this only records when one was last done.
 */
export const opsChecklistCompletions = pgTable(
  "ops_checklist_completions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: text("task_id").notNull(),
    completedBy: text("completed_by").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("ops_checklist_completions_task_idx").on(table.taskId, table.completedAt)],
);

/**
 * The Notification Hub's memory: one row per incident (a problem that is open, then
 * resolved), keyed by a stable fingerprint of what is wrong. It is what lets the hub say
 * "this is new", "this is still happening" or "this is over" instead of repeating itself.
 * A resolved row is kept as history; the same problem coming back is a new row. The journal
 * of what was sent lives in `audit_events` (actor `ops-hub`).
 */
export const opsAlerts = pgTable(
  "ops_alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fingerprint: text("fingerprint").notNull(),
    /** Where it came from: `control-center` (polled) or e.g. `grafana` (pushed). */
    source: text("source").notNull(),
    /** `poll` rows are resolved when they stop appearing; `push` rows when the sender says so (or go quiet). */
    origin: text("origin").notNull(),
    severity: text("severity").notNull(),
    title: text("title").notNull(),
    detail: text("detail"),
    state: text("state").notNull().default("open"),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    /** Null while nothing has been sent, for example during quiet hours. */
    lastNotifiedAt: timestamp("last_notified_at", { withTimezone: true }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    /** Consecutive polls in which a `poll` alert was absent. */
    missedTicks: integer("missed_ticks").notNull().default(0),
    notifyCount: integer("notify_count").notNull().default(0),
  },
  (table) => [
    // At most one open incident per fingerprint; history rows are unconstrained.
    uniqueIndex("ops_alerts_open_fingerprint_idx")
      .on(table.fingerprint)
      .where(sql`${table.state} = 'open'`),
    index("ops_alerts_state_seen_idx").on(table.state, table.lastSeenAt),
    check("ops_alerts_severity_chk", sql`${table.severity} in ('warning', 'critical')`),
    check("ops_alerts_state_chk", sql`${table.state} in ('open', 'resolved')`),
    check("ops_alerts_origin_chk", sql`${table.origin} in ('poll', 'push')`),
  ],
);

export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
export type OpsAlert = typeof opsAlerts.$inferSelect;
export type NewOpsAlert = typeof opsAlerts.$inferInsert;
export type AuditEvent = typeof auditEvents.$inferSelect;
export type NewAuditEvent = typeof auditEvents.$inferInsert;
export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
export type ProductSuspension = typeof productSuspensions.$inferSelect;
export type NewProductSuspension = typeof productSuspensions.$inferInsert;
export type OpsCost = typeof opsCosts.$inferSelect;
export type NewOpsCost = typeof opsCosts.$inferInsert;
export type OpsChecklistCompletion = typeof opsChecklistCompletions.$inferSelect;

/**
 * Growth Engine P0 persistence. Product identity remains a stable registry slug;
 * campaign/content records are organisation-scoped and never trigger external publishing.
 */
export const growthCampaigns = pgTable(
  "growth_campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id").notNull(),
    name: text("name").notNull(),
    objective: text("objective").notNull(),
    status: text("status").notNull().default("draft"),
    ownerId: text("owner_id").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    budgetCents: integer("budget_cents"),
    currency: text("currency").notNull().default("USD"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("growth_campaigns_org_updated_idx").on(table.orgId, table.updatedAt),
    check(
      "growth_campaigns_status_chk",
      sql`${table.status} in ('draft', 'planned', 'active', 'paused', 'completed', 'archived')`,
    ),
    check(
      "growth_campaigns_budget_chk",
      sql`${table.budgetCents} is null or ${table.budgetCents} >= 0`,
    ),
    check(
      "growth_campaigns_dates_chk",
      sql`${table.endsAt} is null or ${table.startsAt} is null or ${table.endsAt} >= ${table.startsAt}`,
    ),
  ],
);

export const growthContentItems = pgTable(
  "growth_content_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id").notNull(),
    campaignId: uuid("campaign_id"),
    productSlug: text("product_slug"),
    title: text("title").notNull(),
    contentType: text("content_type").notNull(),
    channel: text("channel").notNull(),
    status: text("status").notNull().default("draft"),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("growth_content_items_org_status_idx").on(table.orgId, table.status, table.updatedAt),
    index("growth_content_items_org_campaign_idx").on(table.orgId, table.campaignId),
    check(
      "growth_content_items_status_chk",
      sql`${table.status} in ('draft', 'in_review', 'approved', 'archived')`,
    ),
    foreignKey({
      columns: [table.campaignId],
      foreignColumns: [growthCampaigns.id],
      name: "growth_content_campaign_fk",
    }).onDelete("set null"),
  ],
);

export const growthContentVersions = pgTable(
  "growth_content_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id").notNull(),
    contentItemId: uuid("content_item_id").notNull(),
    version: integer("version").notNull(),
    body: text("body").notNull(),
    sourceRefs: jsonb("source_refs").notNull().default([]),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("growth_content_versions_item_version_idx").on(table.contentItemId, table.version),
    index("growth_content_versions_org_item_idx").on(table.orgId, table.contentItemId),
    check("growth_content_versions_version_chk", sql`${table.version} > 0`),
    foreignKey({
      columns: [table.contentItemId],
      foreignColumns: [growthContentItems.id],
      name: "growth_content_version_item_fk",
    }).onDelete("cascade"),
  ],
);

export const growthApprovals = pgTable(
  "growth_approvals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id").notNull(),
    contentVersionId: uuid("content_version_id").notNull(),
    status: text("status").notNull().default("pending"),
    requestedBy: text("requested_by").notNull(),
    reviewedBy: text("reviewed_by"),
    reviewNote: text("review_note"),
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("growth_approvals_one_pending_version_idx")
      .on(table.contentVersionId)
      .where(sql`${table.status} = 'pending'`),
    index("growth_approvals_org_status_requested_idx").on(
      table.orgId,
      table.status,
      table.requestedAt,
    ),
    check(
      "growth_approvals_status_chk",
      sql`${table.status} in ('pending', 'approved', 'rejected', 'withdrawn')`,
    ),
    foreignKey({
      columns: [table.contentVersionId],
      foreignColumns: [growthContentVersions.id],
      name: "growth_approval_version_fk",
    }).onDelete("cascade"),
  ],
);

/**
 * Growth acquisition records. Contact fields are limited to the minimum needed
 * for an organisation's own lead follow-up. Consent is recorded separately
 * from lead status and must never be inferred from source or campaign membership.
 */
export const growthLeads = pgTable(
  "growth_leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id").notNull(),
    email: text("email").notNull(),
    name: text("name"),
    company: text("company"),
    stage: text("stage").notNull().default("new"),
    source: text("source"),
    medium: text("medium"),
    campaignId: uuid("campaign_id"),
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    utmContent: text("utm_content"),
    utmTerm: text("utm_term"),
    consentStatus: text("consent_status").notNull().default("unknown"),
    consentAt: timestamp("consent_at", { withTimezone: true }),
    consentSource: text("consent_source"),
    idempotencyKey: text("idempotency_key"),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("growth_leads_org_stage_created_idx").on(table.orgId, table.stage, table.createdAt),
    index("growth_leads_org_campaign_idx").on(table.orgId, table.campaignId),
    uniqueIndex("growth_leads_org_idempotency_idx")
      .on(table.orgId, table.idempotencyKey)
      .where(sql`${table.idempotencyKey} is not null`),
    check(
      "growth_leads_stage_chk",
      sql`${table.stage} in ('new', 'qualified', 'contacted', 'disqualified')`,
    ),
    check(
      "growth_leads_consent_chk",
      sql`${table.consentStatus} in ('unknown', 'granted', 'denied', 'not_required')`,
    ),
    check(
      "growth_leads_consent_timestamp_chk",
      sql`${table.consentStatus} <> 'granted' or ${table.consentAt} is not null`,
    ),
    foreignKey({
      columns: [table.campaignId],
      foreignColumns: [growthCampaigns.id],
      name: "growth_lead_campaign_fk",
    }).onDelete("set null"),
  ],
);

/** Append-only attribution history for a known lead; no anonymous device fingerprinting. */
export const growthLeadTouchpoints = pgTable(
  "growth_lead_touchpoints",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id").notNull(),
    leadId: uuid("lead_id").notNull(),
    touchpointType: text("touchpoint_type").notNull().default("lead_created"),
    source: text("source"),
    medium: text("medium"),
    campaignId: uuid("campaign_id"),
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    utmContent: text("utm_content"),
    utmTerm: text("utm_term"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    idempotencyKey: text("idempotency_key"),
  },
  (table) => [
    index("growth_lead_touchpoints_org_lead_occurred_idx").on(
      table.orgId,
      table.leadId,
      table.occurredAt,
    ),
    uniqueIndex("growth_lead_touchpoints_org_idempotency_idx")
      .on(table.orgId, table.idempotencyKey)
      .where(sql`${table.idempotencyKey} is not null`),
    foreignKey({
      columns: [table.leadId],
      foreignColumns: [growthLeads.id],
      name: "growth_lead_touchpoint_lead_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.campaignId],
      foreignColumns: [growthCampaigns.id],
      name: "growth_lead_touchpoint_campaign_fk",
    }).onDelete("set null"),
  ],
);

/**
 * Provider connections for Growth Engine. Only an opaque secret-manager reference
 * is persisted; access tokens, refresh tokens and webhook secrets never enter Postgres.
 */
export const growthIntegrations = pgTable(
  "growth_integrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id").notNull(),
    provider: text("provider").notNull(),
    connectionKey: text("connection_key").notNull().default("default"),
    displayName: text("display_name").notNull(),
    status: text("status").notNull().default("disconnected"),
    externalAccountId: text("external_account_id"),
    credentialRef: text("credential_ref"),
    grantedScopes: text("granted_scopes").array().notNull().default([]),
    connectedBy: text("connected_by"),
    connectedAt: timestamp("connected_at", { withTimezone: true }),
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
    lastErrorCode: text("last_error_code"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("growth_integrations_org_provider_key_idx").on(
      table.orgId,
      table.provider,
      table.connectionKey,
    ),
    index("growth_integrations_org_status_idx").on(table.orgId, table.status),
    check(
      "growth_integrations_status_chk",
      sql`${table.status} in ('disconnected', 'pending', 'connected', 'error', 'revoked')`,
    ),
    check(
      "growth_integrations_provider_chk",
      sql`${table.provider} in ('n8n', 'hubspot', 'salesforce', 'resend', 'sendgrid', 'mailchimp', 'linkedin', 'posthog', 'google_search_console', 'github')`,
    ),
  ],
);

/**
 * Durable orchestration ledger. Workers must re-check tenant ownership, credentials
 * and the exact approved content version before performing external side effects.
 */
export const growthWorkflowRuns = pgTable(
  "growth_workflow_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id").notNull(),
    integrationId: uuid("integration_id"),
    workflowKey: text("workflow_key").notNull(),
    triggerType: text("trigger_type").notNull(),
    status: text("status").notNull().default("queued"),
    idempotencyKey: text("idempotency_key").notNull(),
    requiresApproval: boolean("requires_approval").notNull().default(false),
    approvalId: uuid("approval_id"),
    contentVersionId: uuid("content_version_id"),
    resourceType: text("resource_type"),
    resourceId: text("resource_id"),
    externalRunId: text("external_run_id"),
    attemptCount: integer("attempt_count").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    availableAt: timestamp("available_at", { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    errorCode: text("error_code"),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("growth_workflow_runs_org_idempotency_idx").on(table.orgId, table.idempotencyKey),
    index("growth_workflow_runs_org_status_available_idx").on(
      table.orgId,
      table.status,
      table.availableAt,
    ),
    index("growth_workflow_runs_integration_created_idx").on(table.integrationId, table.createdAt),
    check(
      "growth_workflow_runs_status_chk",
      sql`${table.status} in ('queued', 'running', 'succeeded', 'failed', 'cancelled', 'dead_letter')`,
    ),
    check(
      "growth_workflow_runs_trigger_chk",
      sql`${table.triggerType} in ('manual', 'webhook', 'schedule', 'approval')`,
    ),
    check(
      "growth_workflow_runs_attempts_chk",
      sql`${table.attemptCount} >= 0 and ${table.maxAttempts} between 1 and 10 and ${table.attemptCount} <= ${table.maxAttempts}`,
    ),
    check(
      "growth_workflow_runs_approval_chk",
      sql`not ${table.requiresApproval} or (${table.approvalId} is not null and ${table.contentVersionId} is not null)`,
    ),
    foreignKey({
      columns: [table.integrationId],
      foreignColumns: [growthIntegrations.id],
      name: "growth_workflow_integration_fk",
    }).onDelete("set null"),
    foreignKey({
      columns: [table.approvalId],
      foreignColumns: [growthApprovals.id],
      name: "growth_workflow_approval_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.contentVersionId],
      foreignColumns: [growthContentVersions.id],
      name: "growth_workflow_content_version_fk",
    }).onDelete("restrict"),
  ],
);

export type GrowthIntegration = typeof growthIntegrations.$inferSelect;
export type NewGrowthIntegration = typeof growthIntegrations.$inferInsert;
export type GrowthWorkflowRun = typeof growthWorkflowRuns.$inferSelect;
export type NewGrowthWorkflowRun = typeof growthWorkflowRuns.$inferInsert;

export type GrowthLead = typeof growthLeads.$inferSelect;
export type NewGrowthLead = typeof growthLeads.$inferInsert;
export type GrowthLeadTouchpoint = typeof growthLeadTouchpoints.$inferSelect;
export type NewGrowthLeadTouchpoint = typeof growthLeadTouchpoints.$inferInsert;

export type GrowthCampaign = typeof growthCampaigns.$inferSelect;
export type NewGrowthCampaign = typeof growthCampaigns.$inferInsert;
export type GrowthContentItem = typeof growthContentItems.$inferSelect;
export type NewGrowthContentItem = typeof growthContentItems.$inferInsert;
export type GrowthContentVersion = typeof growthContentVersions.$inferSelect;
export type NewGrowthContentVersion = typeof growthContentVersions.$inferInsert;
export type GrowthApproval = typeof growthApprovals.$inferSelect;
export type NewGrowthApproval = typeof growthApprovals.$inferInsert;

/**
 * Organisation-owned marketing context for a registry product.
 * Product identity and lifecycle remain owned by @nexora/registry.
 */
export const growthProductProfiles = pgTable(
  "growth_product_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id").notNull(),
    productSlug: text("product_slug").notNull(),
    idealCustomerProfile: text("ideal_customer_profile").notNull().default(""),
    positioning: text("positioning").notNull().default(""),
    valueProposition: text("value_proposition").notNull().default(""),
    differentiators: text("differentiators").notNull().default(""),
    targetRoles: text("target_roles").array().notNull().default([]),
    useCases: text("use_cases").array().notNull().default([]),
    approvedClaims: text("approved_claims").array().notNull().default([]),
    createdBy: text("created_by").notNull(),
    updatedBy: text("updated_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("growth_product_profiles_org_product_idx").on(table.orgId, table.productSlug),
    index("growth_product_profiles_org_updated_idx").on(table.orgId, table.updatedAt),
    check(
      "growth_product_profiles_slug_chk",
      sql`length(trim(${table.productSlug})) between 1 and 120`,
    ),
    check("growth_product_profiles_roles_chk", sql`cardinality(${table.targetRoles}) <= 30`),
    check("growth_product_profiles_use_cases_chk", sql`cardinality(${table.useCases}) <= 30`),
    check("growth_product_profiles_claims_chk", sql`cardinality(${table.approvedClaims}) <= 50`),
  ],
);

export type GrowthProductProfile = typeof growthProductProfiles.$inferSelect;
export type NewGrowthProductProfile = typeof growthProductProfiles.$inferInsert;

/**
 * Organisation-owned aggregate customer segments. Do not store identifiable
 * personal data in segment descriptions or behavioural signals.
 */
export const growthCustomerSegments = pgTable(
  "growth_customer_segments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    industry: text("industry"),
    companySize: text("company_size"),
    market: text("market"),
    buyingTriggers: text("buying_triggers").array().notNull().default([]),
    createdBy: text("created_by").notNull(),
    updatedBy: text("updated_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("growth_customer_segments_org_name_idx").on(table.orgId, table.name),
    uniqueIndex("growth_customer_segments_org_id_idx").on(table.orgId, table.id),
    index("growth_customer_segments_org_updated_idx").on(table.orgId, table.updatedAt),
    check(
      "growth_customer_segments_name_chk",
      sql`length(trim(${table.name})) between 1 and 120`,
    ),
    check(
      "growth_customer_segments_triggers_chk",
      sql`cardinality(${table.buyingTriggers}) <= 30`,
    ),
  ],
);

/**
 * Reusable, non-identifying buyer personas attached to an organisation segment.
 * Confidence and evidence notes describe the quality of the hypothesis, not a
 * measured probability that an individual will purchase.
 */
export const growthCustomerPersonas = pgTable(
  "growth_customer_personas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id").notNull(),
    segmentId: uuid("segment_id").notNull(),
    productSlug: text("product_slug"),
    name: text("name").notNull(),
    role: text("role").notNull().default(""),
    seniority: text("seniority"),
    goals: text("goals").array().notNull().default([]),
    painPoints: text("pain_points").array().notNull().default([]),
    jobsToBeDone: text("jobs_to_be_done").array().notNull().default([]),
    objections: text("objections").array().notNull().default([]),
    successCriteria: text("success_criteria").array().notNull().default([]),
    buyingSignals: text("buying_signals").array().notNull().default([]),
    evidenceNotes: text("evidence_notes").notNull().default(""),
    confidence: text("confidence").notNull().default("low"),
    status: text("status").notNull().default("draft"),
    createdBy: text("created_by").notNull(),
    updatedBy: text("updated_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("growth_customer_personas_org_segment_name_idx").on(
      table.orgId,
      table.segmentId,
      table.name,
    ),
    index("growth_customer_personas_org_status_idx").on(table.orgId, table.status),
    index("growth_customer_personas_org_product_idx").on(table.orgId, table.productSlug),
    check(
      "growth_customer_personas_name_chk",
      sql`length(trim(${table.name})) between 1 and 120`,
    ),
    check(
      "growth_customer_personas_confidence_chk",
      sql`${table.confidence} in ('low', 'medium', 'high')`,
    ),
    check(
      "growth_customer_personas_status_chk",
      sql`${table.status} in ('draft', 'validated', 'archived')`,
    ),
    check(
      "growth_customer_personas_goals_chk",
      sql`cardinality(${table.goals}) <= 30`,
    ),
    check(
      "growth_customer_personas_pains_chk",
      sql`cardinality(${table.painPoints}) <= 30`,
    ),
    check(
      "growth_customer_personas_jobs_chk",
      sql`cardinality(${table.jobsToBeDone}) <= 30`,
    ),
    check(
      "growth_customer_personas_objections_chk",
      sql`cardinality(${table.objections}) <= 30`,
    ),
    check(
      "growth_customer_personas_success_chk",
      sql`cardinality(${table.successCriteria}) <= 30`,
    ),
    check(
      "growth_customer_personas_signals_chk",
      sql`cardinality(${table.buyingSignals}) <= 30`,
    ),
    foreignKey({
      columns: [table.orgId, table.segmentId],
      foreignColumns: [growthCustomerSegments.orgId, growthCustomerSegments.id],
      name: "growth_customer_persona_segment_fk",
    }).onDelete("cascade"),
  ],
);

export type GrowthCustomerSegment = typeof growthCustomerSegments.$inferSelect;
export type NewGrowthCustomerSegment = typeof growthCustomerSegments.$inferInsert;
export type GrowthCustomerPersona = typeof growthCustomerPersonas.$inferSelect;
export type NewGrowthCustomerPersona = typeof growthCustomerPersonas.$inferInsert;
