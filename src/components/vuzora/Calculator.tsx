/**
 * Calculator — interactive "сколько времени экономит Vuzora".
 *
 * This file is intentionally presentation-only. All state, URL hydration,
 * derived math and share behaviour live in {@link useCalculator}; the Stat
 * sub-component lives in `./calculator/Stat`.
 *
 * Shareable: `?checks=N` in the URL pre-fills the slider, and the
 * "Поделиться" button uses the Web Share API (fallback: clipboard) so the
 * recipient lands on the same slider position.
 */
import { memo, useId } from "react";
import { Kicker } from "./ui/Kicker";
import { useReveal } from "@/hooks/use-reveal";
import { Stat } from "./calculator/Stat";
import {
  CHECKS_MAX,
  CHECKS_MIN,
  MINUTES_PER_CHECK,
  useCalculator,
} from "./calculator/useCalculator";

export const Calculator = memo(function Calculator() {
  const sliderId = useId();
  const ref = useReveal<HTMLDivElement>();
  const { checks, setChecks, perWeek, perYearH, shared, share } = useCalculator();

  const shareLabel =
    shared === "copied"
      ? "Ссылка скопирована"
      : shared === "shared"
        ? "Отправлено"
        : shared === "error"
          ? "Не вышло — попробуй ещё раз"
          : `Поделиться: «${perYearH} ч/год»`;

  return (
    <section
      id="calc"
      className="reveal border-t border-white/5 bg-ink-soft/40 py-20 md:py-28"
      ref={ref}
    >
      <div className="mx-auto max-w-6xl px-6 md:px-12">
        <Kicker dot tone="amber">
          Калькулятор тишины
        </Kicker>
        <h2
          className="mt-4 font-display text-white"
          style={{
            fontSize: "clamp(2rem, 4.5vw, 3.25rem)",
            lineHeight: 1.02,
            fontWeight: 700,
            letterSpacing: "-0.03em",
            textWrap: "balance",
            maxWidth: "20ch",
          }}
        >
          Сколько раз в день ты <span className="text-white/55">открываешь</span> расписание?
        </h2>

        <div className="mt-12 grid gap-10 lg:grid-cols-[1.1fr,1fr] lg:items-center">
          <div>
            <div className="flex items-baseline gap-4">
              <span
                className="font-display tabular text-amber"
                style={{
                  fontSize: "clamp(3.5rem, 9vw, 6rem)",
                  lineHeight: 1,
                  fontWeight: 700,
                  letterSpacing: "-0.04em",
                }}
              >
                {checks}
              </span>
              <span className="text-sm text-white/55">
                {checks === 1 ? "раз в день" : checks < 5 ? "раза в день" : "раз в день"}
              </span>
            </div>

            <label htmlFor={sliderId} className="sr-only">
              Сколько раз в день проверяешь расписание
            </label>
            <input
              id={sliderId}
              type="range"
              min={CHECKS_MIN}
              max={CHECKS_MAX}
              step={1}
              value={checks}
              onChange={(e) => setChecks(Number(e.target.value))}
              className="calc-slider mt-6 w-full accent-amber"
              aria-valuetext={`${checks} проверок в день`}
            />
            <div className="mt-2 flex justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
              <span>{CHECKS_MIN}</span>
              <span>5</span>
              <span>{CHECKS_MAX}</span>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-ink p-6 md:p-8">
            <p className="text-sm text-white/60">С Vuzora ты получишь обратно</p>
            <div className="mt-4 grid grid-cols-2 gap-6">
              <Stat value={`${perWeek}`} unit="мин / неделя" />
              <Stat value={perYearH} unit="часов / год" />
            </div>
            <p className="mt-6 border-t border-white/10 pt-4 text-xs leading-relaxed text-white/45">
              Считаем по {MINUTES_PER_CHECK} минуты на одно открытие сайта вуза – путь до закладки,
              ожидание, поиск своей группы. Vuzora забирает это на себя: одно сообщение утром, в
              выбранное тобой время – и ты свободен.
            </p>

            <button
              type="button"
              onClick={share}
              className="mt-5 inline-flex items-center gap-2 rounded-full border border-amber/40 bg-amber/10 px-4 py-2 text-xs font-medium text-amber transition-colors hover:bg-amber/15"
              aria-live="polite"
            >
              {shareLabel}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
});
