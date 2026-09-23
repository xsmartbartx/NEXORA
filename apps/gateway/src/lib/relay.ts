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
        model: input.model ?? "claude-3-5-haiku-latest",
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

  const raw = await response.json().catch(() => ({ error: "Upstream returned a non-JSON response." }));
  return { ok: response.ok, status: response.status, raw, text: extractText(raw) };
}
