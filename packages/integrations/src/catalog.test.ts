import { describe, expect, it } from "vitest";
import { getIntegrationDefinition, listIntegrationDefinitions } from "./catalog";
import { INTEGRATION_PROVIDERS } from "./types";

describe("integration catalog", () => {
  it("matches the provider allow-list in the database schema", () => {
    expect(listIntegrationDefinitions().map((item) => item.provider).sort()).toEqual(
      [...INTEGRATION_PROVIDERS].sort(),
    );
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
