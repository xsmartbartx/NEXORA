CREATE UNIQUE INDEX "growth_segment_product_fits_org_id_idx"
  ON "growth_segment_product_fits" USING btree ("org_id", "id");
--> statement-breakpoint
CREATE TABLE "growth_strategy_recommendations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" text NOT NULL,
  "source_fit_id" uuid NOT NULL,
  "segment_id" uuid NOT NULL,
  "product_slug" text NOT NULL,
  "category" text NOT NULL,
  "title" text NOT NULL,
  "recommendation" text NOT NULL,
  "rationale" text NOT NULL,
  "evidence_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "confidence" text DEFAULT 'low' NOT NULL,
  "status" text DEFAULT 'draft' NOT NULL,
  "decision_note" text DEFAULT '' NOT NULL,
  "created_by" text NOT NULL,
  "updated_by" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "growth_strategy_recommendations_category_chk"
    CHECK ("category" in ('segment_priority', 'product_gap', 'evidence_gap', 'positioning')),
  CONSTRAINT "growth_strategy_recommendations_confidence_chk"
    CHECK ("confidence" in ('low', 'medium', 'high')),
  CONSTRAINT "growth_strategy_recommendations_status_chk"
    CHECK ("status" in ('draft', 'accepted', 'rejected', 'implemented', 'superseded')),
  CONSTRAINT "growth_strategy_recommendations_title_chk"
    CHECK (length(trim("title")) between 1 and 180),
  CONSTRAINT "growth_strategy_recommendation_segment_fk"
    FOREIGN KEY ("org_id", "segment_id")
    REFERENCES "growth_customer_segments"("org_id", "id") ON DELETE CASCADE,
  CONSTRAINT "growth_strategy_recommendation_fit_fk"
    FOREIGN KEY ("org_id", "source_fit_id")
    REFERENCES "growth_segment_product_fits"("org_id", "id") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX "growth_strategy_recommendations_org_fit_category_idx"
  ON "growth_strategy_recommendations" USING btree ("org_id", "source_fit_id", "category");
--> statement-breakpoint
CREATE INDEX "growth_strategy_recommendations_org_status_idx"
  ON "growth_strategy_recommendations" USING btree ("org_id", "status");
--> statement-breakpoint
CREATE INDEX "growth_strategy_recommendations_org_updated_idx"
  ON "growth_strategy_recommendations" USING btree ("org_id", "updated_at");
