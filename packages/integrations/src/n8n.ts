import { URL } from "node:url";
import { getIntegrationDefinition } from "./catalog";
import type {
  IntegrationAdapter,
  IntegrationConfigIssue,
  IntegrationConfigResult,
  IntegrationDefinition,
} from "./types";

export interface N8nIntegrationConfig {
  /** Canonical n8n instance URL. */
  readonly baseUrl: string;
  /** Opaque secret-manager reference; never an API key value. */
  readonly credentialRef: string;
}

function getN8nDefinition(): IntegrationDefinition {
  const integration = getIntegrationDefinition("n8n");

  if (!integration) {
    throw new Error("The n8n integration definition is missing from the catalog.");
  }

  return integration;
}

const definition = getN8nDefinition();

function isLoopback(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

function validateBaseUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length === 0 || value !== value.trim()) {
    return undefined;
  }

  try {
    const url = new URL(value);
    const secure = url.protocol === "https:";
    const localDevelopment = url.protocol === "http:" && isLoopback(url.hostname);

    if (
      (!secure && !localDevelopment) ||
      !url.hostname ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      return undefined;
    }

    const path = url.pathname.replace(/\/+$/, "");
    return `${url.origin}${path}`;
  } catch {
    return undefined;
  }
}

const credentialRefPattern =
  /^(vault|secret|aws-sm|gcp-sm|azure-kv):\/\/[A-Za-z0-9][A-Za-z0-9._:/-]*$/;

function validateCredentialRef(value: unknown): string | undefined {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value !== value.trim() ||
    value.length > 256 ||
    !credentialRefPattern.test(value)
  ) {
    return undefined;
  }

  return value;
}

export function createN8nAdapter(): IntegrationAdapter<N8nIntegrationConfig> {
  return {
    definition,
    validateConfig(input: unknown): IntegrationConfigResult<N8nIntegrationConfig> {
      const issues: IntegrationConfigIssue[] = [];

      if (typeof input !== "object" || input === null || Array.isArray(input)) {
        return {
          ok: false,
          issues: [{ field: "config", code: "invalid_format" }],
        };
      }

      const config = input as Record<string, unknown>;
      const unsupportedKeys = Object.keys(config).filter(
        (key) => key !== "baseUrl" && key !== "credentialRef",
      );

      if (unsupportedKeys.length > 0) {
        issues.push({ field: "config", code: "unsupported_value" });
      }

      const baseUrl = validateBaseUrl(config.baseUrl);
      if (!baseUrl) {
        issues.push({
          field: "baseUrl",
          code: config.baseUrl === undefined ? "required" : "invalid_format",
        });
      }

      const credentialRef = validateCredentialRef(config.credentialRef);
      if (!credentialRef) {
        issues.push({
          field: "credentialRef",
          code: config.credentialRef === undefined ? "required" : "invalid_format",
        });
      }

      if (issues.length > 0 || !baseUrl || !credentialRef) {
        return { ok: false, issues };
      }

      return {
        ok: true,
        value: {
          baseUrl,
          credentialRef,
        },
      };
    },
  };
}
