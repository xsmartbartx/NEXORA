import {
  check,
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
    check("growth_campaigns_budget_chk", sql`${table.budgetCents} is null or ${table.budgetCents} >= 0`),
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
    campaignId: uuid("campaign_id").references(() => growthCampaigns.id, { onDelete: "set null" }),
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
  ],
);

export const growthContentVersions = pgTable(
  "growth_content_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id").notNull(),
    contentItemId: uuid("content_item_id")
      .notNull()
      .references(() => growthContentItems.id, { onDelete: "cascade" }),
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
  ],
);

export const growthApprovals = pgTable(
  "growth_approvals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id").notNull(),
    contentVersionId: uuid("content_version_id")
      .notNull()
      .references(() => growthContentVersions.id, { onDelete: "cascade" }),
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
  ],
);

export type GrowthCampaign = typeof growthCampaigns.$inferSelect;
export type NewGrowthCampaign = typeof growthCampaigns.$inferInsert;
export type GrowthContentItem = typeof growthContentItems.$inferSelect;
export type NewGrowthContentItem = typeof growthContentItems.$inferInsert;
export type GrowthContentVersion = typeof growthContentVersions.$inferSelect;
export type NewGrowthContentVersion = typeof growthContentVersions.$inferInsert;
export type GrowthApproval = typeof growthApprovals.$inferSelect;
export type NewGrowthApproval = typeof growthApprovals.$inferInsert;
