ALTER TABLE "audit_events" ADD COLUMN "external_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "audit_events_org_external_id_idx" ON "audit_events" USING btree ("org_id","external_id");