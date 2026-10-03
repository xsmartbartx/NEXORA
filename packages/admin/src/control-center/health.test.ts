import { describe, expect, it, vi } from "vitest";
import { SLOW_MS, parseInstantQuery, probeEndpoint } from "./health";

const endpoint = {
  name: "API",
  url: "https://api.example.test/v1/health",
  category: "platform",
} as const;
const respond = (status: number) => ({ status }) as Response;

describe("probeEndpoint", () => {
  it("is up on a 2xx", async () => {
    const result = await probeEndpoint(endpoint, async () => respond(200));
    expect(result.status).toBe("up");
    expect(result.httpStatus).toBe(200);
    expect(result.latencyMs).not.toBeNull();
  });

  it("treats a 3xx as up (redirects aren't followed)", async () => {
    expect((await probeEndpoint(endpoint, async () => respond(307))).status).toBe("up");
  });

  it("retries once, so one dropped connection doesn't read as down", async () => {
    const fetcher = vi
      .fn<(url: string) => Promise<Response>>()
      .mockRejectedValueOnce(new Error("socket hang up"))
      .mockResolvedValueOnce(respond(200));
    const result = await probeEndpoint(endpoint, fetcher);
    expect(result.status).toBe("up");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("is down after two failures, with no latency", async () => {
    const fetcher = vi
      .fn<(url: string) => Promise<Response>>()
      .mockRejectedValue(new Error("nope"));
    const result = await probeEndpoint(endpoint, fetcher);
    expect(result).toMatchObject({ status: "down", httpStatus: null, latencyMs: null });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("is down on a 5xx, and records the status it saw", async () => {
    const result = await probeEndpoint(endpoint, async () => respond(503));
    expect(result).toMatchObject({ status: "down", httpStatus: 503, latencyMs: null });
  });

  it("is degraded, not down, when it answers slowly", async () => {
    const now = vi.spyOn(Date, "now");
    now.mockReturnValueOnce(0).mockReturnValueOnce(SLOW_MS + 1);
    const result = await probeEndpoint(endpoint, async () => respond(200));
    now.mockRestore();
    expect(result.status).toBe("degraded");
  });
});

describe("parseInstantQuery", () => {
  it("reads samples", () => {
    const samples = parseInstantQuery({
      status: "success",
      data: { result: [{ metric: { job: "postgres" }, value: [1700000000, "1"] }] },
    });
    expect(samples).toEqual([{ metric: { job: "postgres" }, value: 1 }]);
  });

  it("returns no samples for an empty result", () => {
    expect(parseInstantQuery({ data: { result: [] } })).toEqual([]);
  });

  it("rejects a malformed response instead of reading it as zero", () => {
    expect(() => parseInstantQuery({})).toThrow();
    expect(() =>
      parseInstantQuery({ data: { result: [{ metric: {}, value: [0, "NaN"] }] } }),
    ).toThrow();
  });
});
