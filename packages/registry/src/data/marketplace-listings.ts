import type { MarketplaceListing } from "../types";

/**
 * Marketplace listings (§14.3 Phase 6) for every taxonomy kind except
 * "app" — apps are Products, listed there already (see types.ts). Two real
 * entries today, describing capabilities that actually ship, not a
 * simplified or aspirational version of them. The other kinds
 * (agent, model, tool) have none yet and render as an honest empty state
 * rather than a fabricated placeholder — the taxonomy exists so the first
 * real one in each is a data change, not a schema rewrite.
 */
export const marketplaceListings: MarketplaceListing[] = [
  {
    id: "mkt_api_v1",
    slug: "nexora-api",
    kind: "api",
    name: "NEXORA API",
    tagline: "One versioned API surface, authenticated by API key, shared across products.",
    description:
      "The public v1 API — key-based authentication, a published error contract and rate limiting, documented at the docs app's `/products` page. Today it fronts Gateway's chat relay; every future product's machine-facing endpoints land on this same surface.",
    provider: "nexora",
    status: "available",
    link: "/products/gateway",
    relatedProduct: "gateway",
    publishedAt: "2026-09-23",
  },
  {
    id: "mkt_integration_gateway_upstream",
    slug: "gateway-model-provider",
    kind: "integration",
    name: "AI model provider integration",
    tagline: "Gateway's live connection to a configurable upstream model provider.",
    description:
      "Gateway forwards authenticated, entitlement-checked requests to one configurable upstream provider (Anthropic-compatible Messages API shape) — a real, live integration, tested end-to-end against a mock upstream in Phase 5, not a mockup. Multi-provider routing is on the roadmap; today it's one provider, correctly.",
    provider: "nexora",
    status: "available",
    link: "/products/gateway",
    relatedProduct: "gateway",
    publishedAt: "2026-09-23",
  },
];
