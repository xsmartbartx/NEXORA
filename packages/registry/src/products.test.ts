import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { getAllProducts } from "./queries";

/**
 * Every product gets a public page at onenexora.com/<path>, so a path must
 * never shadow one of the website's own top-level routes.
 */
const websiteAppDir = fileURLToPath(new URL("../../../apps/website/src/app", import.meta.url));

/** Top-level website routes that are not (or not yet) a directory under src/app. */
const RESERVED_PATHS = [
  // Planned or edge-level routes (§8.1 redirects, the API, auth pages).
  "status",
  "developers",
  "api",
  ".well-known",
  "sign-in",
  "sign-up",
  // File-based routes in src/app and Next's own prefix.
  "robots.txt",
  "sitemap.xml",
  "favicon.ico",
  "opengraph-image",
  "twitter-image",
  "_next",
];

/** Directory names that become a URL segment: route groups `(x)`, private `_x` folders and dynamic `[x]` segments do not. */
function websiteRouteSegments(): string[] {
  return readdirSync(websiteAppDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => !/^[([_@]/.test(name));
}

const URL_SAFE_PATH = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

describe("product paths", () => {
  const products = getAllProducts();

  it("reads the website's top-level routes", () => {
    // Guards the test itself: a wrong directory would make every collision check pass.
    expect(websiteRouteSegments()).toEqual(expect.arrayContaining(["products", "pricing"]));
  });

  it("gives every product a URL-safe path", () => {
    for (const product of products) {
      expect(product.path, product.slug).toMatch(URL_SAFE_PATH);
    }
  });

  it("gives every product a unique path", () => {
    const paths = products.map((product) => product.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("never collides with a website route or a reserved path", () => {
    const taken = new Set([...websiteRouteSegments(), ...RESERVED_PATHS]);
    const collisions = products.filter((product) => taken.has(product.path));
    expect(collisions.map((product) => product.path)).toEqual([]);
  });

  it("keeps Linegist on the slug that billing and entitlements key on", () => {
    const linegist = products.find((product) => product.id === "prod_sentinel");
    expect(linegist?.slug).toBe("sentinel");
    expect(linegist?.path).toBe("linegist");
  });
});
