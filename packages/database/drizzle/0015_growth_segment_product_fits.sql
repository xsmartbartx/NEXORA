CREATE TABLE "growth_segment_product_fits" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" text NOT NULL,
  "segment_id" uuid NOT NULL,
  "product_slug" text NOT NULL,
  "need_alignment_score" integer,
  "capability_coverage_score" integer,
  "urgency_score" integer,
  "budget_readiness_score" integer,
  "buying_committee_fit_score" integer,
  "status" text DEFAULT 'hypothesis' NOT NULL,
  "rationale" text DEFAULT '' NOT NULL,
  "evidence_notes" text DEFAULT '' NOT NULL,
  "created_by" text NOT NULL,
  "updated_by" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "growth_segment_product_fits_slug_chk"
    CHECK (length(trim("product_slug")) between 1 and 120),
  CONSTRAINT "growth_segment_product_fits_status_chk"
    CHECK ("status" in ('hypothesis', 'validated', 'not_fit')),
  CONSTRAINT "growth_segment_product_fits_need_score_chk"
    CHECK ("need_alignment_score" is null or "need_alignment_score" between 0 and 5),
  CONSTRAINT "growth_segment_product_fits_capability_score_chk"
    CHECK ("capability_coverage_score" is null or "capability_coverage_score" between 0 and 5),
  CONSTRAINT "growth_segment_product_fits_urgency_score_chk"
    CHECK ("urgency_score" is null or "urgency_score" between 0 and 5),
  CONSTRAINT "growth_segment_product_fits_budget_score_chk"
    CHECK ("budget_readiness_score" is null or "budget_readiness_score" between 0 and 5),
  CONSTRAINT "growth_segment_product_fits_committee_score_chk"
    CHECK ("buying_committee_fit_score" is null or "buying_committee_fit_score" between 0 and 5),
  CONSTRAINT "growth_segment_product_fits_validated_evidence_chk"
    CHECK ("status" <> 'validated' or length(trim("evidence_notes")) > 0),
  CONSTRAINT "growth_segment_product_fit_segment_fk"
    FOREIGN KEY ("org_id", "segment_id")
    REFERENCES "growth_customer_segments"("org_id", "id") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX "growth_segment_product_fits_org_segment_product_idx"
  ON "growth_segment_product_fits" USING btree ("org_id", "segment_id", "product_slug");
--> statement-breakpoint
CREATE INDEX "growth_segment_product_fits_org_status_idx"
  ON "growth_segment_product_fits" USING btree ("org_id", "status");
--> statement-breakpoint
CREATE INDEX "growth_segment_product_fits_org_updated_idx"
  ON "growth_segment_product_fits" USING btree ("org_id", "updated_at");
