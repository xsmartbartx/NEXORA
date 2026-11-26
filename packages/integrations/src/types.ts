export const INTEGRATION_PROVIDERS = ["n8n","hubspot","salesforce","resend","sendgrid","mailchimp","linkedin","posthog","google_search_console","github"] as const;
export type IntegrationProvider = (typeof INTEGRATION_PROVIDERS)[number];
export type IntegrationCategory = "automation" | "crm" | "email" | "marketing" | "analytics" | "developer";
export type IntegrationAuthMethod = "api_key" | "oauth2" | "webhook";
export type IntegrationCapability = "workflow_trigger" | "workflow_action" | "contact_read" | "contact_write" | "email_send" | "campaign_read" | "campaign_send" | "analytics_read" | "repository_read" | "webhook_receive";
export interface IntegrationDefinition {
  readonly provider: IntegrationProvider;
  readonly displayName: string;
  readonly category: IntegrationCategory;
  readonly authMethod: IntegrationAuthMethod;
  readonly capabilities: readonly IntegrationCapability[];
  readonly supportsWebhooks: boolean;
}
export interface IntegrationConfigIssue {
  readonly field: string;
  readonly code: "required" | "invalid_format" | "unsupported_value";
}
export type IntegrationConfigResult<TConfig> =
  | { readonly ok: true; readonly value: TConfig }
  | { readonly ok: false; readonly issues: readonly IntegrationConfigIssue[] };
/** Adapter contract only. Network execution and provider side effects are separate reviewed runtime slices. */
export interface IntegrationAdapter<TConfig = unknown> {
  readonly definition: IntegrationDefinition;
  validateConfig(input: unknown): IntegrationConfigResult<TConfig>;
}
export type IntegrationErrorCode = "invalid_config" | "unauthorized" | "forbidden" | "rate_limited" | "timeout" | "unavailable" | "provider_error";
export interface SanitizedIntegrationError { readonly code: IntegrationErrorCode; }
/** Raw provider messages and payloads must never cross this boundary. */
export class IntegrationAdapterError extends Error {
  constructor(readonly code: IntegrationErrorCode) { super(code); this.name = "IntegrationAdapterError"; }
}