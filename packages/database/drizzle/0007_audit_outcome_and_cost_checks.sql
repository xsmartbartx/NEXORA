ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_outcome_chk" CHECK ("audit_events"."outcome" in ('success', 'failure'));--> statement-breakpoint
ALTER TABLE "ops_costs" ADD CONSTRAINT "ops_costs_interval_chk" CHECK ("ops_costs"."interval" in ('month', 'year'));--> statement-breakpoint
ALTER TABLE "ops_costs" ADD CONSTRAINT "ops_costs_amount_chk" CHECK ("ops_costs"."amount_cents" >= 0);