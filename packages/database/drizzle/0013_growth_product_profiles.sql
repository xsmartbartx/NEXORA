CREATE TABLE "growth_product_profiles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" text NOT NULL,
  "product_slug" text NOT NULL,
  "ideal_customer_profile" text DEFAULT '' NOT NULL,
  "positioning" text DEFAULT '' NOT NULL,
  "value_proposition" text DEFAULT '' NOT NULL,
  "differentiators" text DEFAULT '' NOT NULL,
  "target_roles" text[] DEFAULT '{}'::text[] NOT NULL,
  "use_cases" text[] DEFAULT '{}'::text[] NOT NULL,
  "approved_claims" text[] DEFAULT '{}'::text[] NOT NULL,
  "created_by" text NOT NULL,
  "updated_by" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "growth_product_profiles_slug_chk" CHECK (length(trim("product_slug")) between 1 and 120),
  CONSTRAINT "growth_product_profiles_roles_chk" CHECK (cardinality("target_roles") <= 30),
  CONSTRAINT "growth_product_profiles_use_cases_chk" CHECK (cardinality("use_cases") <= 30),
  CONSTRAINT "growth_product_profiles_claims_chk" CHECK (cardinality("approved_claims") <= 50)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "growth_product_profiles_org_product_idx" ON "growth_product_profiles" USING btree ("org_id", "product_slug");
--> statement-breakpoint
CREATE INDEX "growth_product_profiles_org_updated_idx" ON "growth_product_profiles" USING btree ("org_id", "updated_at");
