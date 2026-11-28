CREATE TABLE "growth_customer_segments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" text NOT NULL,
  "name" text NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "industry" text,
  "company_size" text,
  "market" text,
  "buying_triggers" text[] DEFAULT '{}'::text[] NOT NULL,
  "created_by" text NOT NULL,
  "updated_by" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "growth_customer_segments_name_chk" CHECK (length(trim("name")) between 1 and 120),
  CONSTRAINT "growth_customer_segments_triggers_chk" CHECK (cardinality("buying_triggers") <= 30)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "growth_customer_segments_org_name_idx" ON "growth_customer_segments" USING btree ("org_id", "name");
--> statement-breakpoint
CREATE UNIQUE INDEX "growth_customer_segments_org_id_idx" ON "growth_customer_segments" USING btree ("org_id", "id");
--> statement-breakpoint
CREATE INDEX "growth_customer_segments_org_updated_idx" ON "growth_customer_segments" USING btree ("org_id", "updated_at");
--> statement-breakpoint
CREATE TABLE "growth_customer_personas" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" text NOT NULL,
  "segment_id" uuid NOT NULL,
  "product_slug" text,
  "name" text NOT NULL,
  "role" text DEFAULT '' NOT NULL,
  "seniority" text,
  "goals" text[] DEFAULT '{}'::text[] NOT NULL,
  "pain_points" text[] DEFAULT '{}'::text[] NOT NULL,
  "jobs_to_be_done" text[] DEFAULT '{}'::text[] NOT NULL,
  "objections" text[] DEFAULT '{}'::text[] NOT NULL,
  "success_criteria" text[] DEFAULT '{}'::text[] NOT NULL,
  "buying_signals" text[] DEFAULT '{}'::text[] NOT NULL,
  "evidence_notes" text DEFAULT '' NOT NULL,
  "confidence" text DEFAULT 'low' NOT NULL,
  "status" text DEFAULT 'draft' NOT NULL,
  "created_by" text NOT NULL,
  "updated_by" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "growth_customer_personas_name_chk" CHECK (length(trim("name")) between 1 and 120),
  CONSTRAINT "growth_customer_personas_confidence_chk" CHECK ("confidence" in ('low', 'medium', 'high')),
  CONSTRAINT "growth_customer_personas_status_chk" CHECK ("status" in ('draft', 'validated', 'archived')),
  CONSTRAINT "growth_customer_personas_goals_chk" CHECK (cardinality("goals") <= 30),
  CONSTRAINT "growth_customer_personas_pains_chk" CHECK (cardinality("pain_points") <= 30),
  CONSTRAINT "growth_customer_personas_jobs_chk" CHECK (cardinality("jobs_to_be_done") <= 30),
  CONSTRAINT "growth_customer_personas_objections_chk" CHECK (cardinality("objections") <= 30),
  CONSTRAINT "growth_customer_personas_success_chk" CHECK (cardinality("success_criteria") <= 30),
  CONSTRAINT "growth_customer_personas_signals_chk" CHECK (cardinality("buying_signals") <= 30),
  CONSTRAINT "growth_customer_persona_segment_fk" FOREIGN KEY ("org_id", "segment_id")
    REFERENCES "growth_customer_segments"("org_id", "id") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX "growth_customer_personas_org_segment_name_idx" ON "growth_customer_personas" USING btree ("org_id", "segment_id", "name");
--> statement-breakpoint
CREATE INDEX "growth_customer_personas_org_status_idx" ON "growth_customer_personas" USING btree ("org_id", "status");
--> statement-breakpoint
CREATE INDEX "growth_customer_personas_org_product_idx" ON "growth_customer_personas" USING btree ("org_id", "product_slug");
