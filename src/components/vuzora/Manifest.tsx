/**
 * Brand-values manifest section ("Надёжный одногруппник…").
 *
 * Editorial `<dl>` listing four brand pillars. Pure presentation —
 * edit the {@link VALUES} array to change copy.
 *
 * @module components/vuzora/Manifest
 */

import { SectionHeader } from "./ui/SectionHeader";

/** Brand pillars rendered as `<dt>`/`<dd>` pairs. */
const VALUES = [
  {
    k: "Точность",
    v: "Время, таймзоны, академические недели, источники – не предмет для шуток. Нет данных – честно об этом скажем.",
  },
  {
    k: "Тепло без приторности",
    v: "На «ты», короткими фразами, человеческим языком. Без маркетингового шума.",
  },
  {
    k: "Без шума",
    v: "Никакой навязчивой рекламы, тёмных паттернов, лишних шагов.",
  },
  {
    k: "Надёжность как фон",
    v: "Идеал – когда о расписании просто не нужно думать.",
  },
];

/** Brand manifest section. */
export function Manifest() {
  return (
    <section id="manifest" className="px-6 py-28 md:px-12 md:py-32">
      <div className="mx-auto max-w-6xl">
        <SectionHeader
          align="left"
          kicker="Личность бренда"
          kickerTone="amber"
          title={
            <>
              Надёжный одногруппник,
              <br />
              <span className="text-white/55">у которого всегда есть план.</span>
            </>
          }
          titleMaxCh={22}
          className="mb-16"
        />

        <dl className="divide-y divide-white/10 border-y border-white/10">
          {VALUES.map((v) => (
            <div
              key={v.k}
              className="grid items-baseline gap-4 py-8 md:grid-cols-[1fr_2fr] md:gap-12 md:py-10"
            >
              <dt
                className="font-display text-2xl font-bold text-white md:text-3xl"
                style={{ letterSpacing: "-0.025em" }}
              >
                {v.k}
              </dt>
              <dd className="max-w-[65ch] text-base leading-relaxed text-white/70 md:text-lg">
                {v.v}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
