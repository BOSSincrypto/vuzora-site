/**
 * Changelog content – manually curated list of product updates.
 * Append new entries to the top of {@link CHANGELOG}.
 *
 * @module content/changelog
 */

export type ChangelogEntry = {
  /** ISO date – drives the displayed date and sort order. */
  date: string;
  /** Short tag shown as a kicker chip. */
  tag: "Запуск" | "Бот" | "Сайт" | "Вузы" | "Подписка";
  /** Headline of the change. */
  title: string;
  /** 1–3 short bullet lines describing what shipped. */
  bullets: readonly string[];
};

/** Newest entries first. */
export const CHANGELOG: readonly ChangelogEntry[] = [
  {
    date: "2026-06-28",
    tag: "Сайт",
    title: "Блог, /changelog и утренний easter egg",
    bullets: [
      "Запущен блог с тремя первыми заметками о философии Vuzora.",
      "Эта страница – теперь публичная история изменений.",
      "Во время утренней рассылки на главной появляется тихая амбер-метка.",
    ],
  },
  {
    date: "2026-06-15",
    tag: "Сайт",
    title: "Калькулятор экономии и социальное доказательство",
    bullets: [
      "Интерактивный слайдер показывает, сколько минут в год экономит Vuzora.",
      "Счётчик waitlist и первые цитаты студентов на главной.",
    ],
  },
  {
    date: "2026-05-30",
    tag: "Подписка",
    title: "Опубликованы тарифы запуска",
    bullets: [
      "1 / 3 / 6 / 12 месяцев, «весь период обучения» и «навсегда».",
      "Бесплатно до 31 октября 2026, дальше – 14 дней пробного периода.",
    ],
  },
  {
    date: "2026-04-10",
    tag: "Вузы",
    title: "Первые вузы в работе",
    bullets: [
      "МГУ, СПбГУ, МГТУ им. Баумана, МФТИ, МИФИ, ВШЭ, МГИМО, РАНХиГС, РЭУ, ФУ, МИРЭА, МЭИ, МИИТ, РГГУ, РУДН, Синергия, СПбПУ, СПбГЭУ, УрФУ, ЮУрГУ, КФУ, СФУ, ННГУ, ДГТУ, ТГУ – на старте 01.09.2026.",
      "Список будет расти по запросу через @vuzora_support_bot.",
    ],
  },
] as const;

/** Format an ISO date as `28 июня 2026`. */
export function formatEntryDate(iso: string): string {
  const dateValue = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00:00.000Z` : iso;
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}
