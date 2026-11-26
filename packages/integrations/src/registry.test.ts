import { describe, expect, it } from "vitest";
import { createIntegrationRegistry } from "./registry";
import type { IntegrationAdapter } from "./types";
const adapter = (provider: "n8n" | "hubspot"): IntegrationAdapter => ({
  definition: { provider, displayName: provider, category: provider === "n8n" ? "automation" : "crm", authMethod: "api_key", capabilities: [], requiredScopes: [], supportsWebhooks: false },
  validateConfig: (input) => ({ ok: true, value: input })
});
describe("createIntegrationRegistry", () => {
  it("resolves only adapters explicitly registered by trusted code", () => {
    const registry = createIntegrationRegistry([adapter("n8n")]);
    expect(registry.has("n8n")).toBe(true);
    expect(registry.get("n8n")?.definition.displayName).toBe("n8n");
    expect(registry.has("hubspot")).toBe(false);
  });
  it("returns a frozen ordered snapshot", () => {
    const first = adapter("n8n"), second = adapter("hubspot");
    const registry = createIntegrationRegistry([first, second]);
    expect(registry.list()).toEqual([first, second]);
    expect(Object.isFrozen(registry.list())).toBe(true);
  });
  it("rejects duplicate provider registrations", () => {
    expect(() => createIntegrationRegistry([adapter("n8n"), adapter("n8n")])).toThrow("Duplicate integration adapter: n8n");
  });
});