/**
 * Tailwind class-name utilities.
 *
 * @module lib/utils
 */

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combine class names with conditional logic (`clsx`) and de-duplicate
 * conflicting Tailwind utilities (`tailwind-merge`).
 *
 * `clsx` lets you pass strings, arrays, and conditional objects:
 *   `cn("p-4", isActive && "bg-amber", { "opacity-50": disabled })`.
 * `twMerge` then resolves Tailwind conflicts so the last wins
 * (`cn("p-2", "p-4")` → `"p-4"` instead of both).
 *
 * @param inputs Any mix of strings, arrays, or `{ class: boolean }` records.
 * @returns Merged class string safe to pass to `className`.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
