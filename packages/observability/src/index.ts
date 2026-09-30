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

/** Call from `instrumentation.ts`'s `register()`, for both the Node and Edge runtimes. */
export function initServerObservability(options: ObservabilityOptions) {
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment,
    tracesSampleRate,
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
    initialScope: { tags: { app: options.app } },
  });
}

/** Re-exported so `instrumentation.ts` doesn't need its own `@sentry/nextjs` dependency just for this one hook. */
export const captureRequestError = Sentry.captureRequestError;
