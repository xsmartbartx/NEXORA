import { describe, expect, it } from "vitest";
import { NEURAWALL_LINK_SCOPE, requireScope } from "./scope";

const key = (scopes: string[]) => ({ keyId: "k1", orgId: "org_1", scopes });

describe("requireScope", () => {
  it("lets a key that has the scope through", async () => {
    expect(requireScope(key([NEURAWALL_LINK_SCOPE]), NEURAWALL_LINK_SCOPE)).toBeNull();
    expect(requireScope(key(["other", NEURAWALL_LINK_SCOPE]), NEURAWALL_LINK_SCOPE)).toBeNull();
  });

  it("refuses a key without it, including a key with no scopes at all", async () => {
    for (const scopes of [[], ["other"], ["neurawall"], ["NEURAWALL:LINK"]]) {
      const response = requireScope(key(scopes), NEURAWALL_LINK_SCOPE);
      expect(response?.status).toBe(403);
      const body = (await response?.json()) as { error: { code: string; message: string } };
      expect(body.error.code).toBe("insufficient_scope");
      expect(body.error.message).toContain(NEURAWALL_LINK_SCOPE);
    }
  });
});
