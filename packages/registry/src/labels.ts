import type { PlatformPillar, ProductCategory, ProductLifecycle } from "./types";

export const lifecycleLabels: Record<ProductLifecycle, string> = {
  concept: "Concept",
  alpha: "Alpha",
  beta: "Beta",
  production: "Production",
  maintenance: "Maintenance",
  retired: "Retired",
};

export const categoryLabels: Record<ProductCategory, string> = {
  ai: "AI",
  security: "Security",
  cloud: "Cloud",
  developer: "Developer",
};

export const pillarLabels: Record<PlatformPillar, string> = {
  ai: "AI",
  security: "Security",
  cloud: "Cloud",
};

export const pillarTaglines: Record<PlatformPillar, string> = {
  ai: "Intelligence, APIs, agents and LLM applications.",
  security: "Cloud security, AI security and threat detection.",
  cloud: "Infrastructure, DevOps and MLOps.",
};
