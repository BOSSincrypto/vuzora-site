/**
 * FAQ section.
 *
 * Native `<details>`/`<summary>` accordion – zero JS, full keyboard support,
 * indexable by search engines. Content comes from {@link FAQ}; the same
 * data feeds the FAQPage JSON-LD on the landing route.
 *
 * @module components/vuzora/Faq
 */

import { SectionHeader } from "./ui/SectionHeader";
import { FAQ } from "@/content/vuzora";

export function Faq() {
  return (
    <section id="faq" className="px-6 py-28 md:px-12 md:py-32">
      <div className="mx-auto max-w-4xl">
        <SectionHeader
          align="left"
          kicker="Вопросы"
          kickerTone="muted"
          title="Что обычно спрашивают."
          lede="Короткие ответы на то, что чаще всего пишут в поддержку – чтобы не пришлось ждать ответа."
          titleMaxCh={22}
          className="mb-12"
        />

        <ul className="divide-y divide-white/10 border-y border-white/10">
          {FAQ.map((item) => (
            <li key={item.q}>
              <details className="group py-5">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-6 text-base font-medium text-white/90 transition-colors hover:text-white md:text-lg">
                  <span className="font-display tracking-tight">{item.q}</span>
                  <span
                    aria-hidden
                    className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/15 text-amber transition-transform duration-300 group-open:rotate-45"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path
                        d="M6 1v10M1 6h10"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                </summary>
                <p className="mt-3 max-w-[68ch] pr-10 text-sm leading-relaxed text-white/65 md:text-[15px]">
                  {item.a}
                </p>
              </details>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
