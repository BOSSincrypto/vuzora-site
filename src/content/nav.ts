/**
 * In-page navigation entries.
 *
 * Each `href` is an anchor to a section on the home page. Render order in
 * the navbar follows this array, and this array follows the order the sections
 * appear in `routes/index.tsx` — a menu that jumps backwards up the page reads
 * as a wrong link even when the anchor resolves.
 *
 * @module content/nav
 */

export const NAV_LINKS = [
  { href: "/#how", label: "Как работает" },
  { href: "/#features", label: "Возможности" },
  { href: "/#calc", label: "Калькулятор" },
  { href: "/#unis", label: "Поддерживаемые вузы" },
  { href: "/#manifest", label: "Манифест" },
  { href: "/#pricing", label: "Тарифы" },
  { href: "/#faq", label: "Вопросы" },
] as const;
