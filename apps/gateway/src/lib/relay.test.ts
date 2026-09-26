import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isUpstreamConfigured, relayChatRequest } from "./relay";

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

  it("uses GATEWAY_DEFAULT_MODEL when set, and a caller's model over both", async () => {
    vi.stubEnv("GATEWAY_UPSTREAM_API_KEY", "test-key");
    vi.stubEnv("GATEWAY_DEFAULT_MODEL", "env-model");
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
