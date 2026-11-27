import { IntegrationAdapterError, type SanitizedIntegrationError } from "./types";

/**
 * Discards provider bodies, URLs, headers, exception messages and credential
 * material.
 */
export function sanitizeIntegrationError(error: unknown): SanitizedIntegrationError {
  return error instanceof IntegrationAdapterError
    ? { code: error.code }
    : { code: "provider_error" };
}
