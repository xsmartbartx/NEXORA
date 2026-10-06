import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  // Usage, Analytics and entitlement counts filter by org + action over a time window.
  (table) => [
    index("audit_events_org_action_created_idx").on(table.orgId, table.action, table.createdAt),
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
export const opsCosts = pgTable("ops_costs", {
  id: uuid("id").primaryKey().defaultRandom(),
  vendor: text("vendor").notNull(),
  label: text("label").notNull().default(""),
  amountCents: integer("amount_cents").notNull(),
  interval: text("interval").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
});

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

export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
export type AuditEvent = typeof auditEvents.$inferSelect;
export type NewAuditEvent = typeof auditEvents.$inferInsert;
export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
export type ProductSuspension = typeof productSuspensions.$inferSelect;
export type NewProductSuspension = typeof productSuspensions.$inferInsert;
export type OpsCost = typeof opsCosts.$inferSelect;
export type NewOpsCost = typeof opsCosts.$inferInsert;
export type OpsChecklistCompletion = typeof opsChecklistCompletions.$inferSelect;
