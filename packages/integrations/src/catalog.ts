import type { IntegrationDefinition } from "./types";
/** Metadata only. Provider-specific OAuth scopes and API-key permissions are resolved by adapters, not guessed here. */
export const INTEGRATION_CATALOG: readonly IntegrationDefinition[] = [
  { provider:"n8n", displayName:"n8n", category:"automation", authMethod:"api_key", capabilities:["workflow_trigger","workflow_action","webhook_receive"], supportsWebhooks:true },
  { provider:"hubspot", displayName:"HubSpot", category:"crm", authMethod:"oauth2", capabilities:["contact_read","contact_write","campaign_read","webhook_receive"], supportsWebhooks:true },
  { provider:"salesforce", displayName:"Salesforce", category:"crm", authMethod:"oauth2", capabilities:["contact_read","contact_write","campaign_read"], supportsWebhooks:true },
  { provider:"resend", displayName:"Resend", category:"email", authMethod:"api_key", capabilities:["email_send"], supportsWebhooks:true },
  { provider:"sendgrid", displayName:"SendGrid", category:"email", authMethod:"api_key", capabilities:["email_send"], supportsWebhooks:true },
  { provider:"mailchimp", displayName:"Mailchimp", category:"marketing", authMethod:"oauth2", capabilities:["contact_read","contact_write","campaign_read","campaign_send"], supportsWebhooks:true },
  { provider:"linkedin", displayName:"LinkedIn", category:"marketing", authMethod:"oauth2", capabilities:["campaign_read"], supportsWebhooks:false },
  { provider:"posthog", displayName:"PostHog", category:"analytics", authMethod:"api_key", capabilities:["analytics_read","webhook_receive"], supportsWebhooks:true },
  { provider:"google_search_console", displayName:"Google Search Console", category:"analytics", authMethod:"oauth2", capabilities:["analytics_read"], supportsWebhooks:false },
  { provider:"github", displayName:"GitHub", category:"developer", authMethod:"oauth2", capabilities:["repository_read","webhook_receive"], supportsWebhooks:true }
] as const;
const byProvider = new Map(INTEGRATION_CATALOG.map((definition) => [definition.provider, definition]));
export function getIntegrationDefinition(provider: string): IntegrationDefinition | undefined {
  return byProvider.get(provider as IntegrationDefinition["provider"]);
}
export function listIntegrationDefinitions(): readonly IntegrationDefinition[] { return INTEGRATION_CATALOG; }