/**
 * Bento-grid feature showcase.
 *
 * Editorial asymmetric grid that highlights what the bot can do. Each tile
 * is a {@link BentoCell}; the largest cell embeds the visual
 * {@link CalendarPreview}. Layout becomes a 6-column dense grid at `md+`.
 *
 * @module components/vuzora/FeatureBento
 */

import { SectionHeader } from "./ui/SectionHeader";
import { BentoCell } from "./features/BentoCell";
import { CalendarPreview } from "./features/CalendarPreview";
import { useReveal } from "@/hooks/use-reveal";

/** Bento-grid features section. */
export function FeatureBento() {
  const gridRef = useReveal<HTMLDivElement>();
  return (
    <section id="features" className="px-6 py-28 md:px-12 md:py-32">
      <div className="mx-auto max-w-6xl">
        <SectionHeader
          title="Что умеет."
          lede={<>Без подписок ради подписок. Только то, что нужно утром.</>}
          titleMaxCh={16}
          className="mb-16"
        />

        <div
          ref={gridRef}
          className="reveal-stagger grid grid-flow-dense gap-3 md:auto-rows-[minmax(180px,auto)] md:grid-cols-6"
        >
          <BentoCell className="md:col-span-4 md:row-span-2">
            <CellLabel>Календарь</CellLabel>
            <h3
              className="mt-3 font-display text-white"
              style={{
                fontSize: "clamp(1.5rem, 3vw, 2.25rem)",
                fontWeight: 700,
                letterSpacing: "-0.03em",
                lineHeight: 1.05,
              }}
            >
              Сегодня. Завтра.
              <br />
              Неделя. Любая дата.
            </h3>
            <p className="mt-3 max-w-[40ch] text-sm text-white/65">
              Интерактивный календарь – спроси расписание на 12 марта, получишь на 12 марта.
            </p>
            <CalendarPreview />
          </BentoCell>

          <BentoCell className="md:col-span-2">
            <CellLabel>Каждое утро</CellLabel>
            <div
              className="mt-3 font-display text-amber"
              style={{
                fontSize: "clamp(2.25rem, 4.5vw, 3.25rem)",
                fontWeight: 800,
                letterSpacing: "-0.04em",
                lineHeight: 1,
              }}
            >
              Когда удобно
            </div>
            <p className="mt-2 text-sm text-white/65">
              Слоты с 05:00 до 10:00 МСК · ты выбираешь свой
            </p>
          </BentoCell>

          <FeatureTile
            label="Понедельник"
            title="Неделя целиком"
            body="Закреплённое сообщение – листать не надо."
            className="md:col-span-2"
          />

          <BentoCell className="md:col-span-3">
            <CellLabel>Поддерживаются</CellLabel>
            <h3 className="mt-3 font-display text-xl font-bold tracking-tight text-white">
              Список вузов растёт
            </h3>
            <p className="mt-2 text-sm text-white/65">
              Подключаем новые вузы по запросу – если есть открытое расписание.
            </p>
            <a
              href="#unis"
              className="mt-4 inline-flex items-center gap-1.5 rounded-sm font-mono text-[11px] uppercase tracking-[0.2em] text-amber hover:text-white focus-visible:text-white"
            >
              Смотреть список
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </a>
          </BentoCell>

          <FeatureTile
            label="Лето"
            title="Не спамим «пар нет»"
            body="Оплаченное время стартует с 1 сентября – не сгорает в каникулы."
            className="md:col-span-3"
          />
          <FeatureTile
            label="Тишина"
            title="Подписка вместо рекламы"
            body="Символическая плата держит бот живым – ни баннеров, ни трекеров, ни партнёрских вставок."
            className="md:col-span-3"
          />
          <FeatureTile
            label="По-человечески"
            title="Пригласи одногруппника"
            body="Реферальная программа без баллов, лотерей и сертификатов."
            className="md:col-span-3"
          />
        </div>
      </div>
    </section>
  );
}

/** Small uppercase eyebrow label local to bento tiles. */
function CellLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/55">
      {children}
    </span>
  );
}

/**
 * Compact bento tile: label + title + body.
 * Used for tiles that don't need bespoke visuals.
 */
function FeatureTile({
  label,
  title,
  body,
  className = "",
}: {
  label: string;
  title: string;
  body: string;
  className?: string;
}) {
  return (
    <BentoCell className={className}>
      <CellLabel>{label}</CellLabel>
      <h3 className="mt-3 font-display text-xl font-bold tracking-tight text-white">{title}</h3>
      <p className="mt-2 text-sm text-white/65">{body}</p>
    </BentoCell>
  );
}
