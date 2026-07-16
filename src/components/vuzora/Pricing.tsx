/**
 * "Цена кофе раз в год." — pricing section.
 *
 * Left column: copy + {@link LaunchTimeline} of milestones.
 * Right column: 2-column grid of {@link PlanCard} tiles.
 *
 * @module components/vuzora/Pricing
 */

import { SectionHeader } from "./ui/SectionHeader";
import { LaunchTimeline } from "./pricing/LaunchTimeline";
import { PlanCard } from "./pricing/PlanCard";
import { CtaButton } from "./ui/CtaButton";
import { PLANS, LINKS } from "@/content/vuzora";

/** Everything that ships in every plan — no fake tiering. */
const INCLUDED: readonly string[] = [
  "Утренняя доставка в удобный тебе слот (05:00–10:00 МСК)",
  "Уведомления об изменениях днём",
  "Смена группы и курса в один тап",
  "Заморозка на каникулах",
  "Без рекламы и сторонних трекеров",
  "Поддержка в Telegram",
];

/** Pricing + launch timeline section. */
export function Pricing() {
  return (
    <section id="pricing" className="px-6 py-28 md:px-12 md:py-32">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-12 md:grid-cols-12 md:gap-16">
          <div className="md:col-span-5">
            <SectionHeader
              align="left"
              kicker="Подписка"
              kickerTone="muted"
              title="Цена кофе раз в год."
              lede="До 31 октября 2026 – бесплатно для всех. Дальше две недели пробного периода и символическая подписка, чтобы Vuzora жил без рекламы и сторонних трекеров."
              titleMaxCh={20}
              className="mb-10"
            />
            <LaunchTimeline />
          </div>

          <div className="md:col-span-7">
            <div className="grid gap-3 sm:grid-cols-2">
              {PLANS.map((p) => (
                <PlanCard key={p.id} plan={p} />
              ))}
            </div>

            <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-5">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/55">
                В любом тарифе
              </p>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {INCLUDED.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2 text-[13px] leading-relaxed text-white/80"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                      className="mt-0.5 shrink-0 text-amber"
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <p className="mt-6 font-mono text-[11px] leading-relaxed text-white/55">
              Оплаченное время не сгорает летом – отсчёт стартует с 1 сентября.
              Без автопродления, без скрытых платежей.
            </p>
            <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-[12px] leading-relaxed text-white/65">
              <p>
                <span className="text-white/85">Возврат средств:</span> в течение
                14 дней с оплаты, если не получил ни одной доставки – вернём
                полностью. Дальше – пропорционально неиспользованному сроку.
              </p>
              <p className="mt-2">
                Полные условия в{" "}
                <a href="/legal/terms" className="underline hover:text-white">
                  публичной оферте
                </a>
                .
              </p>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-4">
              <CtaButton href={LINKS.genericBotUrl} variant="primary" data-cta="generic-conversion">
                Открыть бесплатно · 2 недели
              </CtaButton>
              <a
                href="#faq"
                className="text-sm text-white/55 underline decoration-white/20 underline-offset-4 hover:text-white"
              >
                Вопросы о подписке
              </a>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
