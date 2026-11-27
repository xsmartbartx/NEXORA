export {
  INTEGRATION_CATALOG,
  getIntegrationDefinition,
  listIntegrationDefinitions,
} from "./catalog";

export { sanitizeIntegrationError } from "./errors";

export { createN8nAdapter } from "./n8n";

export type { N8nIntegrationConfig } from "./n8n";

export { createIntegrationRegistry } from "./registry";

export { INTEGRATION_PROVIDERS, IntegrationAdapterError } from "./types";

export type {
  IntegrationAdapter,
  IntegrationAuthMethod,
  IntegrationCapability,
  IntegrationCategory,
  IntegrationConfigIssue,
  IntegrationConfigResult,
  IntegrationDefinition,
  IntegrationErrorCode,
  IntegrationProvider,
  SanitizedIntegrationError,
} from "./types";

export type { IntegrationRegistry } from "./registry";
