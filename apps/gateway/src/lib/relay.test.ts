import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkRelayLimits, isUpstreamConfigured, relayChatRequest } from "./relay";

const messages = [{ role: "user" as const, content: "hi" }];

describe("relayChatRequest", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("GATEWAY_UPSTREAM_URL", "https://upstream.test/v1/messages");
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("returns 503 without calling upstream when no key is configured", async () => {
    vi.stubEnv("GATEWAY_UPSTREAM_API_KEY", "");
    expect(isUpstreamConfigured()).toBe(false);
    const result = await relayChatRequest({ messages });
    expect(result).toMatchObject({ ok: false, status: 503 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("relays to the upstream with auth headers and the default model", async () => {
    vi.stubEnv("GATEWAY_UPSTREAM_API_KEY", "test-key");
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ content: [{ type: "text", text: "hello" }] }), { status: 200 }),
    );

    const result = await relayChatRequest({ messages });

    expect(result).toMatchObject({ ok: true, status: 200, text: "hello" });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://upstream.test/v1/messages");
    expect(init.headers["x-api-key"]).toBe("test-key");
    expect(JSON.parse(init.body)).toMatchObject({ model: "claude-haiku-4-5", messages });
  });

  it("uses GATEWAY_DEFAULT_MODEL when set, and an allow-listed caller model over both", async () => {
    vi.stubEnv("GATEWAY_UPSTREAM_API_KEY", "test-key");
    vi.stubEnv("GATEWAY_DEFAULT_MODEL", "env-model");
    vi.stubEnv("GATEWAY_ALLOWED_MODELS", "env-model,caller-model");
    fetchMock.mockImplementation(async () => new Response("{}", { status: 200 }));

    await relayChatRequest({ messages });
    await relayChatRequest({ messages, model: "caller-model" });

    expect(JSON.parse(fetchMock.mock.calls[0]![1].body).model).toBe("env-model");
    expect(JSON.parse(fetchMock.mock.calls[1]![1].body).model).toBe("caller-model");
  });

  it("passes upstream errors through and survives a non-JSON body", async () => {
    vi.stubEnv("GATEWAY_UPSTREAM_API_KEY", "test-key");
    fetchMock.mockResolvedValue(new Response("<html>bad gateway</html>", { status: 502 }));

    const result = await relayChatRequest({ messages });

    expect(result).toMatchObject({ ok: false, status: 502, text: null });
    expect(result.raw).toEqual({ error: "Upstream returned a non-JSON response." });
  });

  it("returns 502 when the upstream is unreachable", async () => {
    vi.stubEnv("GATEWAY_UPSTREAM_API_KEY", "test-key");
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));

    const result = await relayChatRequest({ messages });

    expect(result).toMatchObject({ ok: false, status: 502, raw: { error: "ECONNREFUSED" } });
  });
});

describe("checkRelayLimits", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("accepts a request with no model and a modest max_tokens", () => {
    expect(checkRelayLimits({ messages, max_tokens: 512 })).toBeNull();
  });

  it("rejects a model that is not the default or on the allow-list", () => {
    expect(checkRelayLimits({ messages, model: "some-expensive-model" })).toMatch(/not available/);
    vi.stubEnv("GATEWAY_ALLOWED_MODELS", "claude-haiku-4-5, other-model");
    expect(checkRelayLimits({ messages, model: "other-model" })).toBeNull();
  });

  it("rejects max_tokens above the cap, or below one, or not a number", () => {
    expect(checkRelayLimits({ messages, max_tokens: 1025 })).toMatch(/max_tokens/);
    expect(checkRelayLimits({ messages, max_tokens: 0 })).toMatch(/max_tokens/);
    expect(checkRelayLimits({ messages, max_tokens: Number.NaN })).toMatch(/max_tokens/);
    vi.stubEnv("GATEWAY_MAX_OUTPUT_TOKENS", "4096");
    expect(checkRelayLimits({ messages, max_tokens: 4096 })).toBeNull();
  });

  it("rejects messages over the input size, and non-string content", () => {
    const big = [{ role: "user" as const, content: "x".repeat(100_001) }];
    expect(checkRelayLimits({ messages: big })).toMatch(/at most 100000/);
    const odd = [{ role: "user" as const, content: { huge: true } as unknown as string }];
    expect(checkRelayLimits({ messages: odd })).toMatch(/at most/);
  });

  it("does not call the upstream when a limit is exceeded", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("GATEWAY_UPSTREAM_API_KEY", "test-key");
    const result = await relayChatRequest({ messages, max_tokens: 100_000 });
    expect(result).toMatchObject({ ok: false, status: 400 });
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
