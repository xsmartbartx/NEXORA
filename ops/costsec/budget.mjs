// Spending guard for agent work: a monthly limit, a warning at 80 %, an automatic stop at
// 100 % and a kill switch. Pure functions; the ledger of what was spent is supplied by the
// caller (Cloud Worker records it in job_runs later). Invalid configuration fails closed.

export const DEFAULT_BUDGET = { monthlyLimitUsd: 10, warnRatio: 0.8, killSwitch: false };

export function parseBudget(raw) {
  const bad = (reason) => ({ ok: false, reason, budget: { ...DEFAULT_BUDGET, killSwitch: true } });
  if (raw === null || typeof raw !== "object") return bad("budget is not an object");
  const { monthlyLimitUsd, warnRatio, killSwitch } = raw;
  if (
    typeof monthlyLimitUsd !== "number" ||
    !Number.isFinite(monthlyLimitUsd) ||
    monthlyLimitUsd <= 0
  ) {
    return bad("monthlyLimitUsd must be a positive number");
  }
  if (typeof warnRatio !== "number" || !(warnRatio > 0 && warnRatio < 1)) {
    return bad("warnRatio must be between 0 and 1");
  }
  if (typeof killSwitch !== "boolean") return bad("killSwitch must be true or false");
  return { ok: true, reason: null, budget: { monthlyLimitUsd, warnRatio, killSwitch } };
}

/** The UTC month ("2026-10") of an ISO timestamp, whatever offset it is written in. */
const monthOf = (iso) => {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : new Date(t).toISOString().slice(0, 7);
};

/** Sum of costUsd for entries stamped in the given UTC month ("2026-10"). Bad entries are ignored. */
export function monthSpend(entries, month) {
  let total = 0;
  for (const e of entries) {
    if (typeof e?.ts !== "string" || monthOf(e.ts) !== month) continue;
    if (typeof e.costUsd === "number" && Number.isFinite(e.costUsd) && e.costUsd > 0)
      total += e.costUsd;
  }
  return Math.round(total * 1e6) / 1e6;
}

/** state: ok | warn (>= warnRatio) | paused (>= limit) | killed (switch on or config invalid). */
export function assess(budget, spentUsd) {
  const ratio = spentUsd / budget.monthlyLimitUsd;
  let state = "ok";
  if (budget.killSwitch) state = "killed";
  else if (ratio >= 1) state = "paused";
  else if (ratio >= budget.warnRatio) state = "warn";
  return {
    state,
    spentUsd,
    limitUsd: budget.monthlyLimitUsd,
    ratio,
    remainingUsd: Math.max(0, budget.monthlyLimitUsd - spentUsd),
  };
}

/** A job may start only if the state allows it and its estimate still fits under the limit. */
export function canSpend(budget, spentUsd, estimateUsd) {
  if (!Number.isFinite(estimateUsd) || estimateUsd < 0) return false;
  const { state } = assess(budget, spentUsd);
  if (state === "paused" || state === "killed") return false;
  return spentUsd + estimateUsd <= budget.monthlyLimitUsd;
}
