/**
 * Vuzora content barrel.
 *
 * Historical single source of truth — the actual definitions now live in
 * focused modules under `src/content/*`. This barrel re-exports them so
 * existing `@/content/vuzora` imports keep working.
 *
 * Prefer importing from the focused module when adding new code:
 *   - `@/content/site`         — BRAND, SITE_URL, abs, LINKS
 *   - `@/content/nav`          — NAV_LINKS
 *   - `@/content/faq`          — FAQ, FaqEntry
 *   - `@/content/universities` — UNIVERSITIES, University
 *   - `@/content/pricing`      — PLANS, Plan, TIMELINE, TimelineEntry, formatPrice
 *
 * @module content/vuzora
 */

export { BRAND, SITE_URL, abs, LINKS } from "./site";
export { NAV_LINKS } from "./nav";
export { FAQ, type FaqEntry } from "./faq";
export { UNIVERSITIES, type University } from "./universities";
export { PLANS, TIMELINE, formatPrice, type Plan, type TimelineEntry } from "./pricing";
