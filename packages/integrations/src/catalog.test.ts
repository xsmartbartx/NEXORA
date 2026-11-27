import { describe, expect, it } from "vitest";
import { getIntegrationDefinition, listIntegrationDefinitions } from "./catalog";
import { INTEGRATION_PROVIDERS } from "./types";

describe("integration catalog", () => {
  it("covers every provider identifier in the typed contract", () => {
    const catalogProviders = listIntegrationDefinitions()
      .map((item) => item.provider)
      .sort();

    expect(catalogProviders).toEqual([...INTEGRATION_PROVIDERS].sort());
  });

  it("returns undefined for unknown providers", () => {
    expect(getIntegrationDefinition("unknown-provider")).toBeUndefined();
  });

  it("contains useful metadata for every listed provider", () => {
    expect(
      listIntegrationDefinitions().every(
        (item) => item.displayName.length > 0 && item.capabilities.length > 0,
      ),
    ).toBe(true);
  });
});
