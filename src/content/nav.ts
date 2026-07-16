/**
 * In-page navigation entries.
 *
 * Each `href` is an anchor to a section on the home page. Render order in
 * the navbar follows this array.
 *
 * @module content/nav
 */

export const NAV_LINKS = [
  { href: "/#how", label: "Как работает" },
  { href: "/#features", label: "Возможности" },
  { href: "/#calc", label: "Калькулятор" },
  { href: "/#unis", label: "Поддерживаемые вузы" },
  { href: "/#pricing", label: "Тарифы" },
  { href: "/#faq", label: "Вопросы" },
  { href: "/#manifest", label: "Манифест" },
] as const;
