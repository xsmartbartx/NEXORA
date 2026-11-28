import { describe, expect, it } from "vitest";
import { getAllProducts } from "@nexora/registry";
import { components } from "./components";

const products = components.filter((component) => component.category === "products");

describe("status components", () => {
  it("lists every registry product that declares a health source", () => {
    const expected = getAllProducts().filter((p) => p.health_source && p.lifecycle !== "retired");
    expect(expected.length).toBeGreaterThan(0);
    for (const product of expected) {
      expect(products).toContainEqual(expect.objectContaining({ checkUrl: product.health_source }));
    }
  });

  it("probes each product at its registry health source", () => {
    const byName = new Map(products.map((component) => [component.name, component.checkUrl]));
    expect(byName.get("OmniFlow")).toBe("https://omniflow.onenexora.com/healthz");
    expect(byName.get("CSPM")).toBe("https://api.cspm.onenexora.com/api/healthz");
    // Vigilo's site and API are separate apps, so both stay probed, as before.
    expect(byName.get("Vigilo")).toBe("https://vigilo.onenexora.com");
    expect(byName.get("Vigilo API")).toBe("https://vigilo-api.onenexora.com/healthz");
  });

  it("gives every component a unique name and an https check URL", () => {
    const names = components.map((component) => component.name);
    expect(new Set(names).size).toBe(names.length);
    for (const component of components) {
      if (component.checkUrl) expect(component.checkUrl).toMatch(/^https:\/\//);
    }
  });
});
