ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_org_id_unique";--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "product" text;--> statement-breakpoint
-- Backfill existing rows (pre-dating per-product billing) as "sentinel" —
-- an arbitrary but harmless choice: any such row predates this migration
-- and is either canceled or will be corrected by the next webhook event.
UPDATE "subscriptions" SET "product" = 'sentinel' WHERE "product" IS NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ALTER COLUMN "product" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_org_product_idx" ON "subscriptions" USING btree ("org_id","product");