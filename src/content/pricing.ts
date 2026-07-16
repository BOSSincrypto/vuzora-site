/**
 * Subscription plans, launch timeline, and price formatting.
 *
 * @module content/pricing
 */

export type Plan = {
  id: string;
  period: string;
  price: number;
  hint: string;
  featured?: boolean;
};

export const PLANS: readonly Plan[] = [
  { id: "1m", period: "1 месяц", price: 49, hint: "Попробовать вдолгую" },
  { id: "3m", period: "3 месяца", price: 79, hint: "Семестр без забот" },
  { id: "6m", period: "6 месяцев", price: 149, hint: "Полугодие" },
  { id: "12m", period: "12 месяцев", price: 249, hint: "Учебный год" },
  { id: "4y", period: "4 года", price: 599, hint: "Весь период обучения", featured: true },
  { id: "lifetime", period: "Навсегда", price: 999, hint: "Поддержать проект" },
] as const;

export type TimelineEntry = { date: string; label: string; body: string };

export const TIMELINE: readonly TimelineEntry[] = [
  {
    date: "01.09.2026",
    label: "Запуск",
    body: "Vuzora открывается для всех вузов из списка поддержки.",
  },
  {
    date: "до 31.10.2026",
    label: "Бесплатно для всех",
    body: "Два месяца без оплаты – пользуйся как обычно, привыкай к утреннему ритуалу.",
  },
  {
    date: "с 01.11.2026",
    label: "Пробный период · 2 недели",
    body: "Новым пользователям – 14 дней, чтобы решить, остаётся ли бот в твоём утре.",
  },
] as const;

/** Format a ruble price using Russian locale rules (space thousands separator). */
export function formatPrice(n: number): string {
  return n.toLocaleString("ru-RU");
}
