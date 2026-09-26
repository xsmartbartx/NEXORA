import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getStatusSnapshot, overallStatus, probe, resetStatusCache } from "./health";

const component = { name: "API", description: "api", checkUrl: "https://api.test/health" };

describe("probe", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    resetStatusCache();
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("reports 2xx and 3xx as operational, without following redirects", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 307 }));

    expect((await probe(component)).status).toBe("operational");
    expect((await probe(component)).status).toBe("operational");
    expect(fetchMock.mock.calls[0]![1].redirect).toBe("manual");
  });

  it("retries once before reporting down", async () => {
    fetchMock.mockRejectedValueOnce(new Error("ECONNRESET"));
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));
    expect((await probe(component)).status).toBe("operational");

    fetchMock.mockResolvedValue(new Response(null, { status: 502 }));
    expect(await probe(component)).toMatchObject({ status: "down", latencyMs: null });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("reports a slow answer as degraded", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(async () => {
      vi.advanceTimersByTime(3_000);
      return new Response(null, { status: 200 });
    });
    expect(await probe(component)).toMatchObject({ status: "degraded", latencyMs: 3_000 });
  });

  it("treats a component without a check URL as operational, unprobed", async () => {
    expect(await probe({ name: "Status", description: "status" })).toMatchObject({
      status: "operational",
      latencyMs: null,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shares one snapshot across requests within 30 seconds", async () => {
    fetchMock.mockImplementation(async () => new Response(null, { status: 200 }));

    await getStatusSnapshot([component], 0);
    await getStatusSnapshot([component], 29_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await getStatusSnapshot([component], 31_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("overallStatus", () => {
  const r = (status: "operational" | "degraded" | "down") => ({
    name: "x",
    description: "x",
    status,
    latencyMs: null,
  });

  it("takes the worst component status", () => {
    expect(overallStatus([r("operational"), r("operational")])).toBe("operational");
    expect(overallStatus([r("operational"), r("degraded")])).toBe("degraded");
    expect(overallStatus([r("degraded"), r("down")])).toBe("down");
  });
});
