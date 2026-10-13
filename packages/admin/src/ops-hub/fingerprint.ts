import type { HubItem } from "./types";

/**
 * A stable identity for "this problem". Digits are folded away so that
 * "13 owner reviews are overdue" and "12 owner reviews are overdue" are the same incident
 * (the count changing is not a new alert), while "api is down" and "docs is down" stay apart.
 */
export function fingerprint(source: string, text: string): string {
  const normalised = text.toLowerCase().replace(/\d+/g, "#").replace(/\s+/g, " ").trim();
  return `${source}:${normalised}`.slice(0, 200);
}

/**
 * Control Center items that belong on its page but should never interrupt anyone. The list is
 * deliberately short and explicit: anything not named here is delivered.
 */
const NOISE: RegExp[] = [/owner review\(s\) (are|is) overdue/i];

export function isNoise(item: Pick<HubItem, "text">): boolean {
  return NOISE.some((pattern) => pattern.test(item.text));
}
