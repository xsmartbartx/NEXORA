import type { Rendered } from "./render";

export type ChannelFormat = "ntfy" | "discord" | "slack" | "generic";

export interface ChannelConfig {
  /** The webhook URL. It is a secret (it often contains a token or topic name): never log it or return it. */
  url: string;
  format?: string;
}

export interface Delivery {
  ok: boolean;
  /** A short, URL-free reason when `ok` is false. */
  error?: string;
}

const FORMATS: ChannelFormat[] = ["ntfy", "discord", "slack", "generic"];

/** Only https, no credentials in the URL. Returns null for anything else. */
export function parseChannelUrl(raw: string | undefined): URL | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url;
  } catch {
    return null;
  }
}

export function detectFormat(url: URL, override?: string): ChannelFormat {
  const wanted = FORMATS.find((f) => f === override);
  if (wanted) return wanted;
  if (url.hostname === "ntfy.sh" || url.hostname.startsWith("ntfy.")) return "ntfy";
  if (/(^|\.)discord(app)?\.com$/.test(url.hostname)) return "discord";
  if (url.hostname === "hooks.slack.com") return "slack";
  return "generic";
}

/** HTTP header values must be plain ASCII. */
const ascii = (text: string): string => text.replace(/[^\x20-\x7e]/g, "?").slice(0, 250);

export function buildRequest(
  format: ChannelFormat,
  n: Rendered,
): { headers: Record<string, string>; body: string } {
  const text = n.message ? `${n.title}\n${n.message}` : n.title;
  switch (format) {
    case "ntfy": {
      const headers: Record<string, string> = {
        Title: ascii(n.title),
        Priority: n.priority,
        Tags: n.tags.join(","),
      };
      if (n.url) headers.Click = n.url;
      return { headers, body: n.message || n.title };
    }
    case "discord":
      return {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text.slice(0, 1900) }),
      };
    case "slack":
      return {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.slice(0, 3000) }),
      };
    default:
      return {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: n.title,
          message: n.message,
          severity: n.severity,
          kind: n.kind,
          source: n.source,
          url: n.url,
        }),
      };
  }
}

export async function deliver(
  config: ChannelConfig,
  n: Rendered,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 8_000,
): Promise<Delivery> {
  const url = parseChannelUrl(config.url);
  if (!url) return { ok: false, error: "the channel URL is missing or not https" };
  const { headers, body } = buildRequest(detectFormat(url, config.format), n);
  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers,
      body,
      redirect: "error",
      signal: AbortSignal.timeout(timeoutMs),
    });
    return response.ok
      ? { ok: true }
      : { ok: false, error: `the channel answered ${response.status}` };
  } catch (error) {
    // The message of a fetch error can include the URL; report the kind of failure only.
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return {
      ok: false,
      error: timedOut ? "the channel timed out" : "the channel could not be reached",
    };
  }
}
