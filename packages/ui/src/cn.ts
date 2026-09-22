import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * clsx alone doesn't resolve conflicting Tailwind utilities (e.g. a base
 * `inline-flex` from a variant plus a caller-supplied `hidden` both set
 * `display`, and whichever rule Tailwind happens to emit last in the
 * stylesheet wins — not whichever class appears last in `className`).
 * twMerge makes className order authoritative instead.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
