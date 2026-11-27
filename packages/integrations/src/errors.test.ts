import { describe, expect, it } from "vitest";
import { sanitizeIntegrationError } from "./errors";
import { IntegrationAdapterError } from "./types";

describe("sanitizeIntegrationError", () => {
  it("preserves stable error codes", () => {
    expect(sanitizeIntegrationError(new IntegrationAdapterError("rate_limited"))).toEqual({
      code: "rate_limited",
    });
  });

  it("discards arbitrary messages and provider response details", () => {
    const secret = "access_token=do-not-log";
    const sanitized = sanitizeIntegrationError({ message: secret, body: secret });

    expect(sanitizeIntegrationError(new Error(secret))).toEqual({ code: "provider_error" });
    expect(JSON.stringify(sanitized)).not.toContain(secret);
  });
});
