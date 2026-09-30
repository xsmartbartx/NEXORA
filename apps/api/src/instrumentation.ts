export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge") {
    const { initServerObservability } = await import("@nexora/observability");
    initServerObservability({ app: "api" });
  }
}

export { captureRequestError as onRequestError } from "@nexora/observability";
