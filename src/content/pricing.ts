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
    label: "Старт семестра",
    body: "Vuzora уже работает для всех вузов из списка поддержки — к началу учебного года всё готово.",
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

/** Everything that ships in every plan — no fake tiering. */
export const INCLUDED: readonly string[] = [
  "Утренняя доставка в удобный тебе слот (05:00–10:00 МСК)",
  "Уведомления об изменениях днём",
  "Смена группы и курса в один тап",
  "Заморозка на каникулах",
  "Без рекламы и сторонних трекеров",
  "Поддержка в Telegram",
] as const;

/** Paid time survives the summer break. */
export const CARRY_OVER_NOTE =
  "Оплаченное время не сгорает летом – отсчёт стартует с 1 сентября. Без автопродления, " +
  "без скрытых платежей.";

/**
 * The refund rule, in the same words the offer and the FAQ use.
 * `scripts/correctness-regressions.test.mjs` fails the build if the three drift.
 */
export const REFUND_NOTE =
  "Возврат средств: в течение 14 дней с оплаты, если не получил ни одной доставки – вернём " +
  "полностью. Дальше – пропорционально неиспользованному сроку.";

/**
 * Plain-sentence summary of the offer.
 *
 * The card grid binds a period to its price by layout: extracted as text the
 * two land in separate runs, so anything reading the page rather than looking
 * at it has to infer the pairing. These sentences state it outright, and they
 * are derived from {@link PLANS} and {@link TIMELINE} so they cannot quote a
 * price the grid no longer charges.
 */
export function pricingFacts(): readonly string[] {
  const prices = PLANS.map((plan) => plan.price);
  const range = `от ${formatPrice(Math.min(...prices))} ₽ до ${formatPrice(Math.max(...prices))} ₽`;
  // «Навсегда» is a card label; mid-sentence it has to read as a common noun.
  const pairs = PLANS.map(
    (plan) =>
      `${plan.period.charAt(0).toLowerCase()}${plan.period.slice(1)} – ${formatPrice(plan.price)} ₽`,
  ).join(", ");
  return [
    `Подписка Vuzora стоит ${range} и зависит только от срока: ${pairs}.`,
    TIMELINE.map((entry) => `${entry.date} – ${entry.label}.`).join(" "),
    CARRY_OVER_NOTE,
    REFUND_NOTE,
  ];
}
