import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { MAX_AGE_MS, readBackupFreshness } from "./freshness";

describe("readBackupFreshness", () => {
  let dir: string;
  const now = Date.UTC(2026, 8, 27, 12, 0, 0);

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "backup-heartbeat-"));
  });

  async function heartbeat(content: string) {
    const file = join(dir, `hb-${Math.random()}`);
    await writeFile(file, content);
    return file;
  }

  it("is ok within the window", async () => {
    const file = await heartbeat(`${(now - 3_600_000) / 1000}\n`);
    expect(await readBackupFreshness(file, now)).toEqual({
      status: "ok",
      lastSuccess: new Date(now - 3_600_000).toISOString(),
    });
  });

  it("is stale once a night has been missed", async () => {
    const file = await heartbeat(String((now - MAX_AGE_MS - 1000) / 1000));
    expect((await readBackupFreshness(file, now)).status).toBe("stale");
  });

  it("is missing when the file is absent or garbage", async () => {
    expect(await readBackupFreshness(join(dir, "nope"), now)).toEqual({
      status: "missing",
      lastSuccess: null,
    });
    expect((await readBackupFreshness(await heartbeat("not a number"), now)).status).toBe(
      "missing",
    );
  });
});
