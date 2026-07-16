/**
 * MorningLoop — animated replacement for the static ChatMockup.
 *
 * Cinematic 12-second CSS loop of the 07:00 МСК ritual:
 *   1. Phone lock screen reads `06:59:58 → 07:00:00`.
 *   2. Vuzora push notification drops in from the top.
 *   3. Notification expands into the chat with today's schedule.
 *   4. Quick exhale, loop.
 *
 * Pure CSS keyframes — no JS, no Lottie payload, no Framer Motion runtime.
 * Disabled under `prefers-reduced-motion: reduce` (handled globally in
 * `styles.css`).
 *
 * @module components/vuzora/MorningLoop
 */

import { Logo } from "./Logo";
import { Kicker } from "./ui/Kicker";

/** Static morning timetable rendered inside the chat layer. */
const TODAY = [
  { time: "09:00", subj: "Матанализ", room: "ауд. 314", type: "лекция" },
  { time: "10:40", subj: "Линейная алгебра", room: "ауд. 207", type: "семинар" },
  { time: "13:00", subj: "Английский язык", room: "ауд. 412", type: "практика" },
  { time: "14:40", subj: "Программирование", room: "ауд. 501", type: "лаб" },
];

/** Side-by-side "headline + animated phone" section. */
export function MorningLoop() {
  return (
    <section className="relative px-6 py-24 md:px-12 md:py-32">
      <div className="mx-auto grid max-w-6xl items-center gap-12 md:gap-16 md:grid-cols-[1fr_1.05fr]">
        <div className="min-w-0">
          <Kicker tone="amber">Доставка, не поиск</Kicker>
          <h2
            className="mt-4 font-display text-white"
            style={{
              fontSize: "clamp(2rem, 4.5vw, 3.5rem)",
              lineHeight: 1.0,
              fontWeight: 700,
              letterSpacing: "-0.03em",
              textWrap: "balance",
            }}
          >
            Не справочник.
            <br />
            <span className="text-white/55">Утренний ритуал.</span>
          </h2>
          <p className="mt-6 max-w-[42ch] text-base leading-relaxed text-white/70">
            Конкуренты заставляют искать. Vuzora открывается уведомлением – расписание уже там,
            точное и на сегодня.
          </p>
          <ul className="mt-8 space-y-2 text-sm text-white/55">
            <li className="flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-amber" /> Push до будильника
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-amber" /> Без открытия приложения вуза
            </li>
          </ul>
        </div>

        {/* Animated phone */}
        <div className="relative min-w-0">
          <div
            className="absolute -inset-8 -z-10 rounded-[2rem] opacity-60 blur-3xl"
            style={{
              background:
                "radial-gradient(ellipse at 30% 30%, color-mix(in srgb, var(--color-violet) 40%, transparent), transparent 60%)",
            }}
            aria-hidden
          />
          <div
            className="morning-loop morning-demo relative mx-auto aspect-[10/16] w-full max-w-[360px] overflow-hidden rounded-[2.25rem] border border-white/10 bg-ink-soft/80 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)] backdrop-blur-xl"
            data-motion-surface="demo"
            role="img"
            aria-label="Анимация: пуш-уведомление Vuzora раскрывается в расписание дня в выбранное тобой утро"
          >
            {/* Status bar (always visible) */}
            <div className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-5 pt-3 font-mono text-[10px] text-white/55">
              <span className="ml-status tabular">06:59</span>
              <span className="flex items-center gap-1">
                <span className="h-1 w-1 rounded-full bg-white/40" />
                <span className="h-1 w-1 rounded-full bg-white/40" />
                <span className="h-1 w-1 rounded-full bg-white/70" />
              </span>
            </div>

            {/* Layer 1 — lock screen */}
            <div className="ml-lock absolute inset-0 z-10 flex flex-col items-center justify-center px-6 text-center">
              <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-white/40">
                понедельник
              </div>
              <div
                className="ml-bigclock mt-2 font-display tabular text-white"
                style={{
                  fontSize: "clamp(3.5rem, 9vw, 5rem)",
                  lineHeight: 1,
                  letterSpacing: "-0.04em",
                }}
              >
                06<span className="ml-colon">:</span>59
              </div>
              <div className="mt-3 text-xs text-white/45">МСК · 27 ноября</div>
            </div>

            {/* Layer 2 — push notification */}
            <div className="ml-push absolute inset-x-3 top-12 z-20 rounded-2xl border border-white/10 bg-white/[0.06] p-3 backdrop-blur-xl">
              <div className="flex items-start gap-3">
                <Logo size={32} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-display text-[12px] font-bold text-white">VUZORA</span>
                    <span className="font-mono text-[10px] text-white/45">сейчас</span>
                  </div>
                  <div className="mt-0.5 truncate text-[13px] font-medium text-white">
                    Расписание · понедельник
                  </div>
                  <div className="mt-0.5 line-clamp-2 text-[12px] text-white/60">
                    4 пары · Матанализ в 09:00, ауд. 314
                  </div>
                </div>
              </div>
            </div>

            {/* Layer 3 — chat with schedule */}
            <div className="ml-chat absolute inset-0 z-25 flex flex-col bg-ink-soft/95 p-4 pt-12">
              <div className="flex items-center gap-2.5 border-b border-white/10 pb-3">
                <Logo size={28} />
                <div className="min-w-0">
                  <div className="font-display text-[12px] font-bold text-white">Vuzora</div>
                  <div className="font-mono text-[9px] text-white/55">bot · онлайн</div>
                </div>
                <span className="ml-auto font-mono text-[10px] tabular text-white/45">07:00</span>
              </div>

              <div className="mt-3 max-w-[94%] rounded-2xl rounded-tl-md bg-white/[0.04] p-3">
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <span className="font-display text-[11px] font-bold tracking-tight text-white">
                    Сегодня · пн, 27 ноября
                  </span>
                  <span className="shrink-0 font-mono text-[9px] text-white/55">4 пары</span>
                </div>
                <ol className="space-y-1.5">
                  {TODAY.map((p, i) => (
                    <li
                      key={p.time}
                      className="ml-row flex items-start gap-2 rounded-md border border-white/10 bg-ink/60 p-2"
                      style={{ animationDelay: `${5.2 + i * 0.25}s` }}
                    >
                      <div className="font-mono text-[10px] tabular text-amber">{p.time}</div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[11px] font-medium text-white">{p.subj}</div>
                        <div className="mt-0.5 font-mono text-[8px] uppercase tracking-wider text-white/55">
                          {p.type} · {p.room}
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
          <p className="mt-4 text-center font-mono text-[10px] uppercase tracking-[0.25em] text-white/30">
            твой слот → пуш → расписание
          </p>
        </div>
      </div>
    </section>
  );
}
