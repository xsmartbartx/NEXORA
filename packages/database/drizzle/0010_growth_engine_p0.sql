CREATE TABLE "growth_campaigns" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" text NOT NULL,
  "name" text NOT NULL,
  "objective" text NOT NULL,
  "status" text DEFAULT 'draft' NOT NULL,
  "owner_id" text NOT NULL,
  "starts_at" timestamp with time zone,
  "ends_at" timestamp with time zone,
  "budget_cents" integer,
  "currency" text DEFAULT 'USD' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "growth_campaigns_status_chk" CHECK ("growth_campaigns"."status" in ('draft', 'planned', 'active', 'paused', 'completed', 'archived')),
  CONSTRAINT "growth_campaigns_budget_chk" CHECK ("growth_campaigns"."budget_cents" is null or "growth_campaigns"."budget_cents" >= 0),
  CONSTRAINT "growth_campaigns_dates_chk" CHECK ("growth_campaigns"."ends_at" is null or "growth_campaigns"."starts_at" is null or "growth_campaigns"."ends_at" >= "growth_campaigns"."starts_at")
);
--> statement-breakpoint
CREATE INDEX "growth_campaigns_org_updated_idx" ON "growth_campaigns" USING btree ("org_id", "updated_at");
--> statement-breakpoint
CREATE TABLE "growth_content_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" text NOT NULL,
  "campaign_id" uuid,
  "product_slug" text,
  "title" text NOT NULL,
  "content_type" text NOT NULL,
  "channel" text NOT NULL,
  "status" text DEFAULT 'draft' NOT NULL,
  "created_by" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "growth_content_items_status_chk" CHECK ("growth_content_items"."status" in ('draft', 'in_review', 'approved', 'archived'))
);
--> statement-breakpoint
CREATE INDEX "growth_content_items_org_status_idx" ON "growth_content_items" USING btree ("org_id", "status", "updated_at");
--> statement-breakpoint
CREATE INDEX "growth_content_items_org_campaign_idx" ON "growth_content_items" USING btree ("org_id", "campaign_id");
--> statement-breakpoint
CREATE TABLE "growth_content_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" text NOT NULL,
  "content_item_id" uuid NOT NULL,
  "version" integer NOT NULL,
  "body" text NOT NULL,
  "source_refs" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_by" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "growth_content_versions_version_chk" CHECK ("growth_content_versions"."version" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "growth_content_versions_item_version_idx" ON "growth_content_versions" USING btree ("content_item_id", "version");
--> statement-breakpoint
CREATE INDEX "growth_content_versions_org_item_idx" ON "growth_content_versions" USING btree ("org_id", "content_item_id");
--> statement-breakpoint
CREATE TABLE "growth_approvals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" text NOT NULL,
  "content_version_id" uuid NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "requested_by" text NOT NULL,
  "reviewed_by" text,
  "review_note" text,
  "requested_at" timestamp with time zone DEFAULT now() NOT NULL,
  "reviewed_at" timestamp with time zone,
  CONSTRAINT "growth_approvals_status_chk" CHECK ("growth_approvals"."status" in ('pending', 'approved', 'rejected', 'withdrawn'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "growth_approvals_one_pending_version_idx" ON "growth_approvals" USING btree ("content_version_id") WHERE "growth_approvals"."status" = 'pending';
--> statement-breakpoint
CREATE INDEX "growth_approvals_org_status_requested_idx" ON "growth_approvals" USING btree ("org_id", "status", "requested_at");
--> statement-breakpoint
ALTER TABLE "growth_content_items" ADD CONSTRAINT "growth_content_items_campaign_id_growth_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "growth_campaigns"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "growth_content_versions" ADD CONSTRAINT "growth_content_versions_content_item_id_growth_content_items_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "growth_content_items"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "growth_approvals" ADD CONSTRAINT "growth_approvals_content_version_id_growth_content_versions_id_fk" FOREIGN KEY ("content_version_id") REFERENCES "growth_content_versions"("id") ON DELETE cascade ON UPDATE no action;
