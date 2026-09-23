import type { DailyEventCount } from "@nexora/telemetry";

export interface DayPoint {
  /** ISO calendar date, "YYYY-MM-DD", UTC. */
  day: string;
  count: number;
}

/**
 * `countOrgEventsByDay` only returns days with at least one event — a
 * sparse chart would misread a quiet day as missing data rather than
 * zero. Pure function, no database access, so it's cheap to unit test.
 */
export function zeroFillDailySeries(
  rows: DailyEventCount[],
  days: number,
  end: Date = new Date(),
): DayPoint[] {
  const counts = new Map(rows.map((row) => [row.day, row.count]));
  const series: DayPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate() - i));
    const key = d.toISOString().slice(0, 10);
    series.push({ day: key, count: counts.get(key) ?? 0 });
  }
  return series;
}
