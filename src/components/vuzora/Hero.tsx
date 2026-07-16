/**
 * Hero — first viewport: aurora gradient, hour grid, live Moscow clock,
 * tagline, and primary CTA pair. Acts as the LCP candidate, so it skips the
 * `content-visibility: auto` deferral applied to the rest of the page.
 *
 * @module components/vuzora/Hero
 */

import { LiveClock } from "./LiveClock";
import { SunriseEgg } from "./SunriseEgg";
import { CtaButton } from "./ui/CtaButton";
import { Kicker } from "./ui/Kicker";
import { LINKS, UNIVERSITIES } from "@/content/vuzora";

/** Static decorative hour labels rendered on the right edge at `xl+` widths. */
const HOURS = ["05:00", "07:00", "09:00", "11:00", "13:00", "15:00", "17:00"];
/** Slots in which Vuzora can deliver schedule – highlighted on the hour grid. */
const DELIVERY_SLOTS = new Set(["05:00", "07:00", "09:00"]);

/** The cinematic above-the-fold hero. */
export function Hero() {
  return (
    <section className="aurora relative isolate overflow-hidden pb-20 pt-28 md:pb-28 md:pt-32">
      <div className="hour-grid absolute inset-0 -z-10 opacity-60" aria-hidden />

      <div className="absolute right-6 top-1/2 hidden -translate-y-1/2 flex-col gap-[60px] font-mono text-[10px] uppercase tracking-[0.2em] text-white/30 xl:flex">
        {HOURS.map((h) => (
          <span key={h} className={DELIVERY_SLOTS.has(h) ? "text-amber" : ""}>
            {h}
          </span>
        ))}
      </div>

      <div className="mx-auto max-w-6xl px-6 md:px-12">
        <div className="mb-10 flex items-start justify-between gap-4 md:mb-14">
          <div className="flex flex-col items-start gap-2">
            <Kicker dot tone="amber">Утром · в удобное тебе время</Kicker>
            <SunriseEgg />
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/55">
              Москва · сейчас
            </span>
            <LiveClock className="text-xl text-white/85 md:text-2xl" />
          </div>
        </div>

        <div className="hero-rise flex flex-col items-center text-center">
          <h1
            className="font-display text-white"
            style={{
              fontSize: "clamp(2.5rem, 6.5vw, 5rem)",
              lineHeight: 0.95,
              fontWeight: 800,
              letterSpacing: "-0.035em",
              textWrap: "balance",
              maxWidth: "18ch",
            }}
          >
            Расписание твоего вуза.
            <br />
            <span className="text-white/70">Каждое утро.</span>
          </h1>
          <p className="mt-6 max-w-[55ch] text-base leading-relaxed text-white/70 md:text-lg">
            Telegram-бот, который сам присылает расписание в удобное тебе время —
            слот с 05:00 до 10:00 МСК выбираешь ты. Без поиска. Без рекламы. Без шума.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-5">
            <CtaButton href={LINKS.botUrl} variant="primary">
              Открыть {LINKS.botHandle}
            </CtaButton>
            <CtaButton href="#how" variant="link" external={false} arrow={false}>
              Как это работает
            </CtaButton>
          </div>
          <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.18em] text-white/45">
            {UNIVERSITIES.length}+ вузов онлайн · 2 недели бесплатно
          </p>
        </div>
      </div>
    </section>
  );
}
