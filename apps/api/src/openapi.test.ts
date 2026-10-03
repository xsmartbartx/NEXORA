import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

const v1Dir = join(__dirname, "app", "v1");
const spec = JSON.parse(readFileSync(join(__dirname, "..", "public", "openapi.json"), "utf8"));

/** `/v1/products/[slug]` -> `/v1/products/{slug}` for every `route.ts` under app/v1, minus webhooks (not part of the public contract). */
function routePaths(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return routePaths(full);
    if (name !== "route.ts") return [];
    const route = "/v1/" + relative(v1Dir, dir).split(sep).join("/");
    return [route.replace(/\[(\w+)\]/g, "{$1}").replace(/\/$/, "")];
  });
}

describe("openapi.json", () => {
  it("documents exactly the public /v1 routes", () => {
    const routes = routePaths(v1Dir)
      .filter((path) => !path.startsWith("/v1/webhooks/"))
      .sort();
    expect(Object.keys(spec.paths).sort()).toEqual(routes);
  });

  it("resolves every $ref", () => {
    const refs = [...JSON.stringify(spec).matchAll(/"\$ref":\s*"#\/([^"]+)"/g)].map((m) => m[1]!);
    for (const ref of refs) {
      const target = ref.split("/").reduce<unknown>((node, key) => (node as never)?.[key], spec);
      expect(target, `#/${ref}`).toBeDefined();
    }
  });
});
