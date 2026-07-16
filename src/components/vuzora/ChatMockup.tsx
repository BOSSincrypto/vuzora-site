/**
 * "Доставка, не поиск" section.
 *
 * Pairs a short value proposition with a faux Telegram chat bubble showing a
 * realistic morning schedule. The mockup is static (no live data) — its job
 * is to communicate the feel of receiving a 07:00 message.
 *
 * @module components/vuzora/ChatMockup
 */

import { Logo } from "./Logo";
import { Kicker } from "./ui/Kicker";

/** Sample timetable rendered inside the mockup message bubble. */
const TODAY = [
  { time: "09:00", subj: "Матанализ", room: "ауд. 314", type: "лекция", prof: "Иванов А. П." },
  {
    time: "10:40",
    subj: "Линейная алгебра",
    room: "ауд. 207",
    type: "семинар",
    prof: "Смирнова Е. В.",
  },
  {
    time: "13:00",
    subj: "Английский язык",
    room: "ауд. 412",
    type: "практика",
    prof: "Кузнецова О. М.",
  },
  { time: "14:40", subj: "Программирование", room: "ауд. 501", type: "лаб", prof: "Петров Д. С." },
];

/** Side-by-side "headline + Telegram bubble" section. */
export function ChatMockup() {
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
        </div>

        {/* Telegram chat mockup */}
        <div className="relative min-w-0">
          <div
            className="absolute -inset-8 -z-10 rounded-[2rem] opacity-60 blur-3xl"
            style={{
              background:
                "radial-gradient(ellipse at 30% 30%, color-mix(in srgb, var(--color-violet) 40%, transparent), transparent 60%)",
            }}
            aria-hidden
          />
          <div className="rounded-[1.75rem] border border-white/10 bg-ink-soft/80 p-5 backdrop-blur-xl shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]">
            {/* chat header */}
            <div className="flex items-center gap-3 border-b border-white/10 pb-4">
              <Logo size={36} />
              <div className="min-w-0">
                <div className="font-display text-sm font-bold text-white">Vuzora</div>
                <div className="font-mono text-[10px] text-white/55">bot · онлайн</div>
              </div>
              <span className="ml-auto font-mono text-[10px] tabular text-white/45">07:00</span>
            </div>

            {/* message bubble */}
            <div className="mt-5 max-w-[92%] rounded-2xl rounded-tl-md bg-white/[0.04] p-4">
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <span className="font-display text-[13px] font-bold tracking-tight text-white">
                  Сегодня · пн, 27 ноября
                </span>
                <span className="shrink-0 font-mono text-[10px] text-white/55">4 пары</span>
              </div>
              <ol className="space-y-2.5">
                {TODAY.map((p) => (
                  <li
                    key={p.time}
                    className="flex items-start gap-3 rounded-lg border border-white/10 bg-ink/60 p-3"
                  >
                    <div className="font-mono text-xs tabular text-amber">{p.time}</div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-white">{p.subj}</div>
                      <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-white/55">
                        {p.type} · {p.room}
                      </div>
                      <div className="mt-1 text-[11px] text-white/65">{p.prof}</div>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {["Завтра", "Неделя", "Календарь", "Настройки"].map((b) => (
                  <span
                    key={b}
                    className="rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-white/80"
                  >
                    {b}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
