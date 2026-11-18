import * as Sentry from "@sentry/nextjs";

/**
 * One shared Sentry project (`nexora-platform`) for every app — `app`
 * tags each event so errors from `gateway` don't get lost in `website`'s
 * noise, without provisioning and wiring ten separate DSNs.
 */
export interface ObservabilityOptions {
  app: string;
}

/** Unset in any environment that hasn't been given a DSN — local dev works with zero Sentry setup. */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const environment = process.env.NEXT_PUBLIC_NEXORA_ENV ?? "development";

/** 100% of errors, a small sample of traces — full tracing on every request isn't worth the free-tier quota this project runs on. */
const tracesSampleRate = environment === "production" ? 0.1 : 0;

/** Header, cookie and query names that carry a client's IP or identity; the SDK's own list for `sendDefaultPii: false`. */
const IDENTITY_KEYS = ["forwarded", "-ip", "remote-", "via", "-user"];

/**
 * What Sentry may collect, spelled out field by field. Request and response
 * bodies hold customer data (Gateway prompts and model replies, log
 * samples, cloud configuration), so they never go to Sentry, and neither
 * does the user's IP or identity.
 *
 * Every field is set on purpose: once `dataCollection` is present, the SDK
 * fills any field left out with its permissive default (bodies, user info
 * and AI inputs and outputs on), and v11 uses those defaults even when
 * `dataCollection` is absent. These values match what v10 sent with
 * `sendDefaultPii` off. GraphQL data and local variables are off too; no
 * app uses either. The SDK always strips keys, tokens and session values
 * from headers, cookies and query strings on top of this.
 *
 * `mcp` and `queues` only exist from v11 (both default to on there); v10
 * ignores them. The object is not annotated with the SDK's type so those
 * two can sit here before the upgrade; `Sentry.init` still checks the
 * rest. When upgrading Sentry, look for new `dataCollection` fields and
 * add them here.
 */
const dataCollection = {
  userInfo: false,
  cookies: { deny: IDENTITY_KEYS },
  httpHeaders: { request: { deny: IDENTITY_KEYS }, response: { deny: IDENTITY_KEYS } },
  httpBodies: [],
  urlQueryParams: { deny: IDENTITY_KEYS },
  graphQL: { document: false, variables: false },
  genAI: { inputs: false, outputs: false },
  mcp: { inputs: false, outputs: false },
  databaseQueryData: false,
  queues: false,
  stackFrameVariables: false,
  frameContextLines: 7,
};

/** Call from `instrumentation.ts`'s `register()`, for both the Node and Edge runtimes. */
export function initServerObservability(options: ObservabilityOptions) {
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment,
    tracesSampleRate,
    dataCollection,
    initialScope: { tags: { app: options.app } },
  });
}

/** Call at module scope from `instrumentation-client.ts`. */
export function initClientObservability(options: ObservabilityOptions) {
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment,
    tracesSampleRate,
    dataCollection,
    initialScope: { tags: { app: options.app } },
  });
}

/** Re-exported so `instrumentation.ts` doesn't need its own `@sentry/nextjs` dependency just for this one hook. */
export const captureRequestError = Sentry.captureRequestError;
