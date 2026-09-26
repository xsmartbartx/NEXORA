CREATE TABLE "product_suspensions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"product" text NOT NULL,
	"reason" text NOT NULL,
	"suspended_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "product_suspensions_org_product_idx" ON "product_suspensions" USING btree ("org_id","product");