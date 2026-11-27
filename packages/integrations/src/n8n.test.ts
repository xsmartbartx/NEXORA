import { describe, expect, it } from "vitest";
import { createN8nAdapter } from "./n8n";

describe("n8n adapter configuration", () => {
  const adapter = createN8nAdapter();

  it("exposes the n8n catalog definition", () => {
    expect(adapter.definition.provider).toBe("n8n");
    expect(adapter.definition.authMethod).toBe("api_key");
  });

  it("accepts HTTPS instances and normalizes a trailing slash", () => {
    expect(
      adapter.validateConfig({
        baseUrl: "https://automation.example.com/",
        credentialRef: "vault://nexora/orgs/acme/n8n",
      }),
    ).toEqual({
      ok: true,
      value: {
        baseUrl: "https://automation.example.com",
        credentialRef: "vault://nexora/orgs/acme/n8n",
      },
    });
  });

  it("allows HTTP only for loopback development instances", () => {
    expect(
      adapter.validateConfig({
        baseUrl: "http://localhost:5678/",
        credentialRef: "secret://n8n/dev",
      }).ok,
    ).toBe(true);

    expect(
      adapter.validateConfig({
        baseUrl: "http://automation.example.com",
        credentialRef: "secret://n8n/prod",
      }),
    ).toMatchObject({ ok: false });
  });

  it.each([
    "not-a-url",
    "ftp://automation.example.com",
    "https://user:password@automation.example.com",
    "https://automation.example.com?token=secret",
    "https://automation.example.com#fragment",
    "http://192.0.2.10:5678",
  ])("rejects unsafe or malformed instance URL: %s", (baseUrl) => {
    expect(
      adapter.validateConfig({
        baseUrl,
        credentialRef: "vault://nexora/orgs/acme/n8n",
      }),
    ).toMatchObject({ ok: false });
  });

  it("requires a secret-manager URI rather than a raw API key value", () => {
    expect(
      adapter.validateConfig({
        baseUrl: "https://automation.example.com",
        credentialRef: "vault://nexora/orgs/acme/n8n",
        apiKey: "must-not-be-accepted",
      }),
    ).toMatchObject({ ok: false });

    expect(
      adapter.validateConfig({
        baseUrl: "https://automation.example.com",
        credentialRef: "plain-api-key-value",
      }),
    ).toMatchObject({ ok: false });
  });

  it("returns field-level issues without echoing supplied values", () => {
    const result = adapter.validateConfig({
      baseUrl: "http://automation.example.com",
      credentialRef: "secret value",
    });

    expect(result).toEqual({
      ok: false,
      issues: [
        { field: "baseUrl", code: "invalid_format" },
        { field: "credentialRef", code: "invalid_format" },
      ],
    });
    expect(JSON.stringify(result)).not.toContain("secret value");
  });

  it("rejects non-object configuration", () => {
    expect(adapter.validateConfig(null)).toEqual({
      ok: false,
      issues: [{ field: "config", code: "invalid_format" }],
    });
  });
});
