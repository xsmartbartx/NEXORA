/**
 * Every Control Center tile is collected independently and reports one of
 * three states, so the page never shows an invented number: real data, an
 * explicit "this source isn't connected" with how to connect it, or a
 * failure. One slow or broken source can't blank the whole dashboard.
 */
export type Tile<T> =
  | { state: "ok"; data: T }
  | { state: "not-connected"; what: string; setup: string }
  | { state: "error"; message: string };

/** Thrown by a collector whose credentials/config aren't present — distinct from a source that is configured but failing. */
export class NotConnected extends Error {
  constructor(
    readonly what: string,
    readonly setup: string,
  ) {
    super(`${what} is not connected`);
    this.name = "NotConnected";
  }
}

export function isNotConnected(error: unknown): error is NotConnected {
  return error instanceof NotConnected;
}

const DEFAULT_TIMEOUT_MS = 10_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms / 1000}s`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Messages are shown in the UI, so keep them short and never echo a
 * request URL or header (a token could ride along in either).
 */
function describeError(error: unknown): string {
  const message = error instanceof Error ? error.message : "unknown error";
  return message.replace(/\s+/g, " ").slice(0, 160);
}

export async function collect<T>(
  fn: () => Promise<T>,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Tile<T>> {
  try {
    return { state: "ok", data: await withTimeout(fn(), timeoutMs) };
  } catch (error) {
    if (isNotConnected(error)) {
      return { state: "not-connected", what: error.what, setup: error.setup };
    }
    return { state: "error", message: describeError(error) };
  }
}

/** Fetch with a hard timeout; the caller decides what a non-2xx means. */
export async function timedFetch(
  url: string,
  init: RequestInit = {},
  timeoutMs = 6_000,
): Promise<Response> {
  // `cache` is a Next.js fetch option that @types/node's RequestInit doesn't
  // declare (the DOM typings the apps compile with do), so assert the shape.
  const options = {
    cache: "no-store",
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
  } as RequestInit;
  return fetch(url, options);
}
