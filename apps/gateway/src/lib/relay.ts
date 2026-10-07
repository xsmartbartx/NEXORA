/**
 * The real relay behind Gateway today: one configurable upstream, proxied
 * with auth/entitlement/rate-limit/audit applied by the callers (the /v1
 * route and the console-session playground both call this, never the
 * upstream directly — see §4.2, "Gateway sits between applications and AI
 * model providers"). Multi-provider routing and a policy engine (model
 * allowlists, per-org routing rules) are the natural next step on top of
 * this same interface, not a rewrite — today there is exactly one upstream.
 *
 * Defaults to Anthropic's Messages API shape since that's this stack's
 * named default provider, but `GATEWAY_UPSTREAM_URL` makes the actual
 * upstream fully swappable — including to a local mock during testing,
 * which is how this file's proxy mechanics were verified without a paid
 * provider key (see the Phase 5 build notes).
 */
export interface RelayMessage {
  role: "user" | "assistant";
  content: string;
}

export interface RelayRequest {
  model?: string;
  messages: RelayMessage[];
  max_tokens?: number;
}

export interface RelayResult {
  ok: boolean;
  status: number;
  /** The upstream's raw response body, passed through as-is for API callers. */
  raw: unknown;
  /** Best-effort plain text, for the playground — null if the shape wasn't recognized. */
  text: string | null;
}

function extractText(raw: unknown): string | null {
  if (
    typeof raw === "object" &&
    raw !== null &&
    "content" in raw &&
    Array.isArray((raw as { content: unknown }).content)
  ) {
    const block = (raw as { content: { type?: string; text?: string }[] }).content[0];
    if (block?.type === "text" && typeof block.text === "string") return block.text;
  }
  return null;
}

function numberFromEnv(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

function defaultModel(): string {
  return process.env.GATEWAY_DEFAULT_MODEL ?? "claude-haiku-4-5";
}

/**
 * Gateway relays with NEXORA's own upstream key and bills customers a flat
 * per-request quota, so what one request may cost has to be bounded here:
 * the caller picks neither an arbitrary (expensive) model nor an unbounded
 * output or prompt size. Returns an error message, or null when the request
 * is within limits. `GATEWAY_ALLOWED_MODELS` (comma-separated),
 * `GATEWAY_MAX_OUTPUT_TOKENS` and `GATEWAY_MAX_INPUT_CHARS` override the
 * defaults (the default model only, 1024 tokens, 100,000 characters).
 */
export function checkRelayLimits(input: RelayRequest): string | null {
  const allowed = (process.env.GATEWAY_ALLOWED_MODELS ?? defaultModel())
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  if (input.model !== undefined && !allowed.includes(input.model)) {
    return `Model "${input.model}" is not available. Allowed: ${allowed.join(", ")}.`;
  }
  const maxOutput = numberFromEnv("GATEWAY_MAX_OUTPUT_TOKENS", 1024);
  if (input.max_tokens !== undefined && !(input.max_tokens >= 1 && input.max_tokens <= maxOutput)) {
    return `"max_tokens" must be between 1 and ${maxOutput}.`;
  }
  const maxInput = numberFromEnv("GATEWAY_MAX_INPUT_CHARS", 100_000);
  const inputChars = input.messages.reduce(
    (sum, m) => sum + (typeof m.content === "string" ? m.content.length : maxInput + 1),
    0,
  );
  if (inputChars > maxInput) {
    return `Messages must total at most ${maxInput} characters.`;
  }
  return null;
}

export function isUpstreamConfigured(): boolean {
  return Boolean(process.env.GATEWAY_UPSTREAM_API_KEY);
}

export async function relayChatRequest(input: RelayRequest): Promise<RelayResult> {
  const upstreamUrl = process.env.GATEWAY_UPSTREAM_URL ?? "https://api.anthropic.com/v1/messages";
  const upstreamApiKey = process.env.GATEWAY_UPSTREAM_API_KEY;

  if (!upstreamApiKey) {
    return {
      ok: false,
      status: 503,
      raw: { error: "Upstream provider not configured. Set GATEWAY_UPSTREAM_API_KEY." },
      text: null,
    };
  }

  const limitError = checkRelayLimits(input);
  if (limitError) {
    return { ok: false, status: 400, raw: { error: limitError }, text: null };
  }

  let response: Response;
  try {
    response = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": upstreamApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: input.model ?? defaultModel(),
        max_tokens: input.max_tokens ?? 256,
        messages: input.messages,
      }),
    });
  } catch (err) {
    return {
      ok: false,
      status: 502,
      raw: { error: err instanceof Error ? err.message : "Upstream unreachable." },
      text: null,
    };
  }

  const raw = await response
    .json()
    .catch(() => ({ error: "Upstream returned a non-JSON response." }));
  return { ok: response.ok, status: response.status, raw, text: extractText(raw) };
}
