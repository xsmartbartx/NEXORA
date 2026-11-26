import type { IntegrationAdapter, IntegrationProvider } from "./types";
export interface IntegrationRegistry {
  get(provider: IntegrationProvider): IntegrationAdapter | undefined;
  list(): readonly IntegrationAdapter[];
  has(provider: IntegrationProvider): boolean;
}
/** Only trusted server code can register adapters; no dynamic imports or user-controlled registration. */
export function createIntegrationRegistry(adapters: readonly IntegrationAdapter[]): IntegrationRegistry {
  const byProvider = new Map<IntegrationProvider, IntegrationAdapter>();
  for (const adapter of adapters) {
    const provider = adapter.definition.provider;
    if (byProvider.has(provider)) throw new Error(`Duplicate integration adapter: ${provider}`);
    byProvider.set(provider, adapter);
  }
  const snapshot = Object.freeze([...byProvider.values()]);
  return Object.freeze({
    get: (provider: IntegrationProvider) => byProvider.get(provider),
    list: () => snapshot,
    has: (provider: IntegrationProvider) => byProvider.has(provider)
  });
}