/**
 * Final call-to-action block.
 *
 * Large emotional sign-off with the live Moscow clock and a white Telegram CTA.
 * The site footer lives in `./Footer`.
 *
 * @module components/vuzora/CallToWake
 */

import { LiveClock } from "./LiveClock";
import { CtaButton } from "./ui/CtaButton";
import { LINKS } from "@/content/vuzora";

/** Closing CTA section. */
export function CallToWake() {
  return (
    <section className="relative overflow-hidden border-y border-white/10 px-6 py-32 md:px-12 md:py-40">
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 60% 80% at 50% 100%, rgba(255,176,32,0.18), transparent 70%), radial-gradient(ellipse 80% 60% at 50% 0%, rgba(79,60,255,0.4), transparent 65%)",
        }}
        aria-hidden
      />
      <div className="mx-auto max-w-3xl text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/55">
          Москва · сейчас
        </p>
        <LiveClock className="mt-4 block text-3xl text-white md:text-5xl" />
        <h2
          className="mt-12 font-display text-white"
          style={{
            fontSize: "clamp(2.25rem, 6vw, 4.5rem)",
            lineHeight: 0.98,
            fontWeight: 800,
            letterSpacing: "-0.04em",
            textWrap: "balance",
          }}
        >
          Подключись сегодня –<br />
          <span className="text-amber">проснись с расписанием.</span>
        </h2>
        <div className="mt-10 flex items-center justify-center">
          <CtaButton href={LINKS.botUrl} variant="white">
            Открыть {LINKS.botHandle}
          </CtaButton>
        </div>
      </div>
    </section>
  );
}


// Re-export for backwards compatibility with existing imports.
export { Footer } from "./Footer";
