/**
 * "Три шага. Один раз." — onboarding section on the cream/mist surface.
 *
 * Renders a fixed three-step ordered list. Step 01 references a few
 * supported universities; the list is derived from {@link UNIVERSITIES} so
 * it stays in sync when new universities are added.
 *
 * @module components/vuzora/HowItWorks
 */

import { SectionHeader } from "./ui/SectionHeader";
import { UNIVERSITIES } from "@/content/vuzora";

/** Onboarding steps rendered in order. */
const STEPS = [
  {
    n: "01",
    title: "Выбери свой вуз",
    body: `${UNIVERSITIES.slice(0, 4)
      .map((u) => u.code)
      .join(", ")} и другие. Список расширяется.`,
  },
  {
    n: "02",
    title: "Найди свою группу",
    body: "Быстрый поиск по номеру. Закрепляется один раз.",
  },
  {
    n: "03",
    title: "Получай утром",
    body: "В удобное тебе время — слоты с 05:00 до 10:00 МСК. По понедельникам – вся неделя.",
  },
];

/** Three-step onboarding section. */
export function HowItWorks() {
  return (
    <section id="how" className="bg-mist px-6 py-28 text-ink md:px-12 md:py-36">
      <div className="mx-auto max-w-6xl">
        <SectionHeader
          theme="light"
          align="left"
          title="Три шага. Один раз."
          lede={
            <span className="text-ink/65">
              Дальше расписание приходит само. Если что-то поменялось в вузе – обновится тоже само.
            </span>
          }
          titleMaxCh={16}
          className="mb-16"
        />

        <ol className="space-y-2">
          {STEPS.map((s, i) => (
            <li
              key={s.n}
              className={`grid grid-cols-[auto_1fr] items-baseline gap-x-8 gap-y-3 border-t border-ink/10 py-10 md:grid-cols-[auto_1fr_2fr] md:gap-x-12 md:py-12 ${
                i === STEPS.length - 1 ? "border-b" : ""
              }`}
            >
              <div
                className="tabular font-display text-violet"
                style={{
                  fontSize: "clamp(3rem, 7vw, 5.5rem)",
                  fontWeight: 800,
                  letterSpacing: "-0.04em",
                  lineHeight: 0.9,
                }}
                aria-hidden
              >
                {s.n}
              </div>
              <h3
                className="font-display text-2xl font-bold tracking-tight md:text-3xl"
                style={{ letterSpacing: "-0.025em" }}
              >
                <span className="sr-only">Шаг {s.n}. </span>
                {s.title}
              </h3>
              <p className="col-start-2 max-w-[40ch] text-base text-ink/65 md:col-start-3 md:row-start-1 md:text-right md:text-lg">
                {s.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
