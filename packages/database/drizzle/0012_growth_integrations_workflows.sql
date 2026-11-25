CREATE TABLE "growth_integrations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" text NOT NULL,
  "provider" text NOT NULL,
  "connection_key" text DEFAULT 'default' NOT NULL,
  "display_name" text NOT NULL,
  "status" text DEFAULT 'disconnected' NOT NULL,
  "external_account_id" text,
  "credential_ref" text,
  "granted_scopes" text[] DEFAULT '{}'::text[] NOT NULL,
  "connected_by" text,
  "connected_at" timestamp with time zone,
  "last_verified_at" timestamp with time zone,
  "last_error_code" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "growth_integrations_status_chk" CHECK ("growth_integrations"."status" in ('disconnected', 'pending', 'connected', 'error', 'revoked')),
  CONSTRAINT "growth_integrations_provider_chk" CHECK ("growth_integrations"."provider" in ('n8n', 'hubspot', 'salesforce', 'resend', 'sendgrid', 'mailchimp', 'linkedin', 'posthog', 'google_search_console', 'github'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "growth_integrations_org_provider_key_idx" ON "growth_integrations" USING btree ("org_id", "provider", "connection_key");
--> statement-breakpoint
CREATE INDEX "growth_integrations_org_status_idx" ON "growth_integrations" USING btree ("org_id", "status");
--> statement-breakpoint
CREATE TABLE "growth_workflow_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" text NOT NULL,
  "integration_id" uuid,
  "workflow_key" text NOT NULL,
  "trigger_type" text NOT NULL,
  "status" text DEFAULT 'queued' NOT NULL,
  "idempotency_key" text NOT NULL,
  "requires_approval" boolean DEFAULT false NOT NULL,
  "approval_id" uuid,
  "content_version_id" uuid,
  "resource_type" text,
  "resource_id" text,
  "external_run_id" text,
  "attempt_count" integer DEFAULT 0 NOT NULL,
  "max_attempts" integer DEFAULT 5 NOT NULL,
  "available_at" timestamp with time zone DEFAULT now() NOT NULL,
  "started_at" timestamp with time zone,
  "finished_at" timestamp with time zone,
  "error_code" text,
  "created_by" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "growth_workflow_runs_status_chk" CHECK ("growth_workflow_runs"."status" in ('queued', 'running', 'succeeded', 'failed', 'cancelled', 'dead_letter')),
  CONSTRAINT "growth_workflow_runs_trigger_chk" CHECK ("growth_workflow_runs"."trigger_type" in ('manual', 'webhook', 'schedule', 'approval')),
  CONSTRAINT "growth_workflow_runs_attempts_chk" CHECK ("growth_workflow_runs"."attempt_count" >= 0 and "growth_workflow_runs"."max_attempts" between 1 and 10 and "growth_workflow_runs"."attempt_count" <= "growth_workflow_runs"."max_attempts"),
  CONSTRAINT "growth_workflow_runs_approval_chk" CHECK (not "growth_workflow_runs"."requires_approval" or ("growth_workflow_runs"."approval_id" is not null and "growth_workflow_runs"."content_version_id" is not null)),
  CONSTRAINT "growth_workflow_integration_fk" FOREIGN KEY ("integration_id") REFERENCES "growth_integrations"("id") ON DELETE set null,
  CONSTRAINT "growth_workflow_approval_fk" FOREIGN KEY ("approval_id") REFERENCES "growth_approvals"("id") ON DELETE restrict,
  CONSTRAINT "growth_workflow_content_version_fk" FOREIGN KEY ("content_version_id") REFERENCES "growth_content_versions"("id") ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX "growth_workflow_runs_org_idempotency_idx" ON "growth_workflow_runs" USING btree ("org_id", "idempotency_key");
--> statement-breakpoint
CREATE INDEX "growth_workflow_runs_org_status_available_idx" ON "growth_workflow_runs" USING btree ("org_id", "status", "available_at");
--> statement-breakpoint
CREATE INDEX "growth_workflow_runs_integration_created_idx" ON "growth_workflow_runs" USING btree ("integration_id", "created_at");
