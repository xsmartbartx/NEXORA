import { describe, expect, it } from "vitest";
import { NotConnected, collect } from "./result";

describe("collect", () => {
  it("wraps a value as ok", async () => {
    expect(await collect(async () => 42)).toEqual({ state: "ok", data: 42 });
  });

  it("reports an unconfigured source as not-connected, with how to connect it", async () => {
    const tile = await collect(async () => {
      throw new NotConnected("Sentry", "Set SENTRY_AUTH_TOKEN.");
    });
    expect(tile).toEqual({
      state: "not-connected",
      what: "Sentry",
      setup: "Set SENTRY_AUTH_TOKEN.",
    });
  });

  it("reports a failing source as an error rather than throwing", async () => {
    const tile = await collect(async () => {
      throw new Error("Stripe answered 401");
    });
    expect(tile).toEqual({ state: "error", message: "Stripe answered 401" });
  });

  it("times out a source that never answers", async () => {
    const tile = await collect(() => new Promise<never>(() => undefined), 20);
    expect(tile.state).toBe("error");
    expect(tile.state === "error" && tile.message).toMatch(/timed out/);
  });

  it("keeps error messages short and single-line", async () => {
    const tile = await collect(async () => {
      throw new Error(`line one\n\n${"x".repeat(500)}`);
    });
    expect(tile.state === "error" && tile.message).not.toContain("\n");
    expect(tile.state === "error" && tile.message.length).toBeLessThanOrEqual(160);
  });
});
