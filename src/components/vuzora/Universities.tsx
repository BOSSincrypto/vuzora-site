/**
 * Universities section.
 *
 * Renders a responsive grid of every entry in {@link UNIVERSITIES} plus a
 * trailing "suggest a university" prompt that opens the support bot
 * ({@link LINKS.supportBotUrl}).
 *
 * @module components/vuzora/Universities
 */

import { SectionHeader } from "./ui/SectionHeader";
import { CtaButton } from "./ui/CtaButton";
import { LINKS, UNIVERSITIES } from "@/content/vuzora";

/** Supported-universities grid + "suggest a university" CTA. */
export function Universities() {
  return (
    <section id="unis" className="relative px-6 py-28 md:px-12 md:py-32">
      <div className="mx-auto max-w-6xl">
        <SectionHeader
          kicker="Поддерживаемые вузы"
          kickerDot
          title={<>Список вузов растёт. Дальше – по запросу.</>}
          lede={
            <>
              Если твоего вуза нет – напиши в Telegram, добавим в очередь.
              Источник расписаний – официальные системы вузов.
            </>
          }
          titleMaxCh={18}
        />

        <ul className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/5 md:grid-cols-2">
          {UNIVERSITIES.map((u) => (
            <li
              key={u.code}
              className="group flex items-start gap-5 bg-ink p-6 transition-colors hover:bg-ink-soft/70 md:p-7"
            >
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] font-mono text-[11px] font-medium tracking-tight text-white/85">
                {u.code}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-base font-semibold leading-snug text-white">
                  {u.name}
                </h3>
                <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-white/55">
                  {u.city}
                </p>
              </div>
              <span className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-300/90">
                {u.status === "online" ? "Онлайн" : "Скоро"}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-dashed border-white/10 px-6 py-5">
          <div>
            <p className="font-display text-base font-semibold text-white">
              Нет твоего вуза?
            </p>
            <p className="mt-1 text-sm text-white/65">
              Напиши в Telegram – добавим, если есть открытое расписание.
            </p>
          </div>
          <CtaButton href={LINKS.supportBotUrl} variant="ghost" arrow={false}>
            Предложить вуз
          </CtaButton>
        </div>
      </div>
    </section>
  );
}
