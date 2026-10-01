import type { Experiment } from "../types";

/**
 * One real entry, not a placeholder: a write-up of the actual algorithm
 * behind Sentinel (apps/sentinel/src/lib/analyze.ts), published as Labs
 * research per §8.7. Add more by appending here — nothing else changes
 * (Phase 5 exit criteria: "a Labs experiment can be published without
 * touching the products catalogue").
 */
export const experiments: Experiment[] = [
  {
    id: "exp_log_anomaly_baseline",
    slug: "log-anomaly-baseline",
    title: "Log anomaly detection: a statistical baseline",
    summary:
      "How Sentinel flags anomalous log lines without a trained model — keyword rules plus frequency-based outlier detection on a normalized line shape.",
    kind: "research",
    link: "/labs/log-anomaly-baseline",
    publishedAt: "2026-09-23",
  },
  {
    id: "exp_ai_models_studio",
    slug: "ai-models-studio",
    title: "AI Models Studio",
    summary:
      "A model playground for fine-tuning and evaluation — an early, independently hosted exploration of what an AI Models product on NEXORA's AI pillar could look like. Not yet on Core identity/billing.",
    kind: "open-source",
    link: "https://github.com/xsmartbartx/AI-Models-Studio",
    publishedAt: "2026-10-01",
  },
  {
    id: "exp_ai_models_iaas",
    slug: "ai-models-iaas",
    title: "AI Models IaaS",
    summary:
      "Infrastructure-as-a-service groundwork for deploying and serving models — the counterpart to AI Models Studio. Independently hosted, not yet a NEXORA product.",
    kind: "open-source",
    link: "https://github.com/xsmartbartx/AI_Models-IaaS",
    publishedAt: "2026-10-01",
  },
];
