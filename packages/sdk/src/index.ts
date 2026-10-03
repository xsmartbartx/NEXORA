export type ProductLifecycle =
  "concept" | "alpha" | "beta" | "production" | "maintenance" | "retired";

export interface ProductSummary {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  category: "ai" | "security" | "cloud" | "developer";
  platform_pillar: "ai" | "security" | "cloud";
  lifecycle: ProductLifecycle;
  url: string;
}

export interface Product extends ProductSummary {
  description: string;
}

export interface RateLimit {
  limit: number;
  remaining: number;
  /** Unix seconds when the window resets. */
  reset: number;
}

export class NexoraApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly requestId: string,
    readonly rateLimit: RateLimit | null,
  ) {
    super(message);
    this.name = "NexoraApiError";
  }
}

export interface NexoraClientOptions {
  /** Organisation API key (`nx_live_...`). */
  apiKey: string;
  baseUrl?: string;
  fetch?: typeof fetch;
}

export interface NexoraResult<T> {
  data: T;
  rateLimit: RateLimit | null;
}

function readRateLimit(headers: Headers): RateLimit | null {
  const limit = headers.get("X-RateLimit-Limit");
  const remaining = headers.get("X-RateLimit-Remaining");
  const reset = headers.get("X-RateLimit-Reset");
  if (limit === null || remaining === null || reset === null) return null;
  return { limit: Number(limit), remaining: Number(remaining), reset: Number(reset) };
}

export class NexoraClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: NexoraClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? "https://api.onenexora.com").replace(/\/$/, "");
    this.fetchImpl = options.fetch ?? fetch;
  }

  private async get<T>(path: string): Promise<NexoraResult<T>> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      headers: { Authorization: `Bearer ${this.apiKey}`, Accept: "application/json" },
    });
    const rateLimit = readRateLimit(response.headers);
    const body = (await response.json()) as
      { data: T } | { error: { code: string; message: string; request_id: string } };
    if ("error" in body) {
      throw new NexoraApiError(
        response.status,
        body.error.code,
        body.error.message,
        body.error.request_id,
        rateLimit,
      );
    }
    return { data: body.data, rateLimit };
  }

  listProducts(): Promise<NexoraResult<ProductSummary[]>> {
    return this.get("/v1/products");
  }

  getProduct(slug: string): Promise<NexoraResult<Product>> {
    return this.get(`/v1/products/${encodeURIComponent(slug)}`);
  }
}
