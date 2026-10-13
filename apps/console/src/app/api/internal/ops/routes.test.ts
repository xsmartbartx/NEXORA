import { beforeEach, describe, expect, it, vi } from "vitest";

const hub = vi.hoisted(() => ({
  checkBearer: vi.fn(),
  runHubTick: vi.fn(),
  receiveHubEvents: vi.fn(),
}));
vi.mock("@nexora/admin", () => hub);

import { POST as tick } from "./tick/route";
import { POST as events } from "./events/route";

const summary = {
  ran: true,
  open: 1,
  opened: 1,
  resolved: 0,
  sent: 1,
  failed: 0,
  deferred: 0,
  channel: true,
};
const post = (url: string, body = "{}", headers: Record<string, string> = {}) =>
  new Request(`http://console${url}`, { method: "POST", body, headers });

beforeEach(() => {
  vi.clearAllMocks();
  hub.runHubTick.mockResolvedValue(summary);
  hub.receiveHubEvents.mockResolvedValue(summary);
});

describe.each([
  ["tick", tick, "/api/internal/ops/tick"],
  ["events", events, "/api/internal/ops/events"],
])("the %s route's gate", (_name, handler, url) => {
  it("does not exist (404, empty) when no token is configured", async () => {
    hub.checkBearer.mockReturnValue("disabled");
    const res = await handler(post(url));
    expect(res.status).toBe(404);
    expect(await res.text()).toBe("");
    expect(hub.runHubTick).not.toHaveBeenCalled();
    expect(hub.receiveHubEvents).not.toHaveBeenCalled();
  });

  it("answers 401 to a wrong token and does no work", async () => {
    hub.checkBearer.mockReturnValue("unauthorized");
    const res = await handler(post(url, "{}", { authorization: "Bearer nope" }));
    expect(res.status).toBe(401);
    expect(hub.runHubTick).not.toHaveBeenCalled();
    expect(hub.receiveHubEvents).not.toHaveBeenCalled();
  });

  it("hands the Authorization header and the configured token to the checker", async () => {
    hub.checkBearer.mockReturnValue("unauthorized");
    process.env.OPS_HUB_TOKEN = "configured-token-value-1234567890";
    await handler(post(url, "{}", { authorization: "Bearer abc" }));
    expect(hub.checkBearer).toHaveBeenCalledWith("Bearer abc", "configured-token-value-1234567890");
    delete process.env.OPS_HUB_TOKEN;
  });
});

describe("POST /api/internal/ops/tick", () => {
  it("runs a tick and returns the counts", async () => {
    hub.checkBearer.mockReturnValue("ok");
    const res = await tick(post("/api/internal/ops/tick"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(summary);
    expect(hub.runHubTick).toHaveBeenCalledTimes(1);
  });
});

describe("POST /api/internal/ops/events", () => {
  beforeEach(() => hub.checkBearer.mockReturnValue("ok"));

  it("passes a parsed body to the hub", async () => {
    const body = { source: "backup", title: "Backup is late" };
    const res = await events(post("/api/internal/ops/events", JSON.stringify(body)));
    expect(res.status).toBe(200);
    expect(hub.receiveHubEvents).toHaveBeenCalledWith(body);
  });

  it("rejects malformed JSON with 400", async () => {
    const res = await events(post("/api/internal/ops/events", "{nope"));
    expect(res.status).toBe(400);
    expect(hub.receiveHubEvents).not.toHaveBeenCalled();
  });

  it("rejects an oversized body with 413 before parsing it", async () => {
    const res = await events(post("/api/internal/ops/events", "x".repeat(70 * 1024)));
    expect(res.status).toBe(413);
    expect(hub.receiveHubEvents).not.toHaveBeenCalled();
  });

  it("answers 422 for a payload the hub does not understand", async () => {
    hub.receiveHubEvents.mockResolvedValue(null);
    const res = await events(post("/api/internal/ops/events", JSON.stringify({ hello: "world" })));
    expect(res.status).toBe(422);
  });
});
