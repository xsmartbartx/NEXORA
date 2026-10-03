import { describe, expect, it } from "vitest";
import { CHECKLIST, dueState } from "./checklist";

const now = Date.parse("2026-10-30T12:00:00Z");
const ago = (days: number) => new Date(now - days * 86_400_000);

describe("dueState", () => {
  it("is ok inside the window", () => {
    expect(dueState("daily", ago(0.5), now)).toBe("ok");
    expect(dueState("weekly", ago(6), now)).toBe("ok");
    expect(dueState("monthly", ago(29), now)).toBe("ok");
  });

  it("is due once the window has elapsed, up to a second window", () => {
    expect(dueState("daily", ago(1.5), now)).toBe("due");
    expect(dueState("weekly", ago(10), now)).toBe("due");
    expect(dueState("monthly", ago(45), now)).toBe("due");
  });

  it("is overdue after two windows, or if never done", () => {
    expect(dueState("daily", ago(3), now)).toBe("overdue");
    expect(dueState("monthly", ago(61), now)).toBe("overdue");
    expect(dueState("weekly", null, now)).toBe("overdue");
  });
});

describe("CHECKLIST", () => {
  it("has unique ids and valid https links", () => {
    const ids = CHECKLIST.map((task) => task.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const task of CHECKLIST) expect(task.href).toMatch(/^https:\/\//);
  });

  it("covers every cadence", () => {
    for (const cadence of ["daily", "weekly", "monthly"]) {
      expect(CHECKLIST.some((task) => task.cadence === cadence)).toBe(true);
    }
  });
});
