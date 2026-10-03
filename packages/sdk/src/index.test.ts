import { describe, expect, it } from "vitest";
import { NexoraApiError, NexoraClient } from "./index";

function fakeFetch(status: number, body: unknown, headers: Record<string, string> = {}) {
  const calls: { url: string; auth: string | null }[] = [];
  const impl = (async (url: string, init?: RequestInit) => {
    calls.push({ url, auth: new Headers(init?.headers).get("Authorization") });
    return new Response(JSON.stringify(body), { status, headers });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe("NexoraClient", () => {
  it("sends the bearer key and returns data plus rate-limit info", async () => {
    const { impl, calls } = fakeFetch(
      200,
      { data: [{ slug: "sentinel" }] },
      {
        "X-RateLimit-Limit": "60",
        "X-RateLimit-Remaining": "59",
        "X-RateLimit-Reset": "1790000000",
      },
    );
    const client = new NexoraClient({
      apiKey: "nx_live_x",
      baseUrl: "https://api.test/",
      fetch: impl,
    });
    const result = await client.listProducts();
    expect(calls[0]).toEqual({ url: "https://api.test/v1/products", auth: "Bearer nx_live_x" });
    expect(result.data).toHaveLength(1);
    expect(result.rateLimit).toEqual({ limit: 60, remaining: 59, reset: 1790000000 });
  });

  it("throws NexoraApiError with the standard error shape", async () => {
    const { impl } = fakeFetch(404, {
      error: { code: "product_not_found", message: "nope", request_id: "abc" },
    });
    const client = new NexoraClient({ apiKey: "k", fetch: impl });
    const error = await client.getProduct("x y").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NexoraApiError);
    expect(error).toMatchObject({ status: 404, code: "product_not_found", requestId: "abc" });
  });

  it("url-encodes the slug", async () => {
    const { impl, calls } = fakeFetch(200, { data: {} });
    await new NexoraClient({ apiKey: "k", baseUrl: "https://a.test", fetch: impl }).getProduct(
      "a/b",
    );
    expect(calls[0]!.url).toBe("https://a.test/v1/products/a%2Fb");
  });
});
