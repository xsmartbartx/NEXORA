CREATE TABLE "ops_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fingerprint" text NOT NULL,
	"source" text NOT NULL,
	"origin" text NOT NULL,
	"severity" text NOT NULL,
	"title" text NOT NULL,
	"detail" text,
	"state" text DEFAULT 'open' NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_notified_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"missed_ticks" integer DEFAULT 0 NOT NULL,
	"notify_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "ops_alerts_severity_chk" CHECK ("ops_alerts"."severity" in ('warning', 'critical')),
	CONSTRAINT "ops_alerts_state_chk" CHECK ("ops_alerts"."state" in ('open', 'resolved')),
	CONSTRAINT "ops_alerts_origin_chk" CHECK ("ops_alerts"."origin" in ('poll', 'push'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "ops_alerts_open_fingerprint_idx" ON "ops_alerts" USING btree ("fingerprint") WHERE "ops_alerts"."state" = 'open';--> statement-breakpoint
CREATE INDEX "ops_alerts_state_seen_idx" ON "ops_alerts" USING btree ("state","last_seen_at");