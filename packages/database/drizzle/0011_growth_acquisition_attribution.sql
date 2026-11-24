CREATE TABLE "growth_leads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" text NOT NULL,
  "email" text NOT NULL,
  "name" text,
  "company" text,
  "stage" text DEFAULT 'new' NOT NULL,
  "source" text,
  "medium" text,
  "campaign_id" uuid,
  "utm_source" text,
  "utm_medium" text,
  "utm_campaign" text,
  "utm_content" text,
  "utm_term" text,
  "consent_status" text DEFAULT 'unknown' NOT NULL,
  "consent_at" timestamp with time zone,
  "consent_source" text,
  "idempotency_key" text,
  "created_by" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "growth_leads_stage_chk" CHECK ("growth_leads"."stage" in ('new', 'qualified', 'contacted', 'disqualified')),
  CONSTRAINT "growth_leads_consent_chk" CHECK ("growth_leads"."consent_status" in ('unknown', 'granted', 'denied', 'not_required')),
  CONSTRAINT "growth_leads_consent_timestamp_chk" CHECK ("growth_leads"."consent_status" <> 'granted' or "growth_leads"."consent_at" is not null)
);
--> statement-breakpoint
CREATE INDEX "growth_leads_org_stage_created_idx" ON "growth_leads" USING btree ("org_id", "stage", "created_at");
--> statement-breakpoint
CREATE INDEX "growth_leads_org_campaign_idx" ON "growth_leads" USING btree ("org_id", "campaign_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "growth_leads_org_idempotency_idx" ON "growth_leads" USING btree ("org_id", "idempotency_key") WHERE "growth_leads"."idempotency_key" is not null;
--> statement-breakpoint
CREATE TABLE "growth_lead_touchpoints" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" text NOT NULL,
  "lead_id" uuid NOT NULL,
  "touchpoint_type" text DEFAULT 'lead_created' NOT NULL,
  "source" text,
  "medium" text,
  "campaign_id" uuid,
  "utm_source" text,
  "utm_medium" text,
  "utm_campaign" text,
  "utm_content" text,
  "utm_term" text,
  "occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
  "idempotency_key" text
);
--> statement-breakpoint
CREATE INDEX "growth_lead_touchpoints_org_lead_occurred_idx" ON "growth_lead_touchpoints" USING btree ("org_id", "lead_id", "occurred_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "growth_lead_touchpoints_org_idempotency_idx" ON "growth_lead_touchpoints" USING btree ("org_id", "idempotency_key") WHERE "growth_lead_touchpoints"."idempotency_key" is not null;
--> statement-breakpoint
ALTER TABLE "growth_leads" ADD CONSTRAINT "growth_lead_campaign_fk" FOREIGN KEY ("campaign_id") REFERENCES "growth_campaigns"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "growth_lead_touchpoints" ADD CONSTRAINT "growth_lead_touchpoint_lead_fk" FOREIGN KEY ("lead_id") REFERENCES "growth_leads"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "growth_lead_touchpoints" ADD CONSTRAINT "growth_lead_touchpoint_campaign_fk" FOREIGN KEY ("campaign_id") REFERENCES "growth_campaigns"("id") ON DELETE set null ON UPDATE no action;
