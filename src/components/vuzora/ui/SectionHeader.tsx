/**
 * Standard section header used at the top of most landing-page sections:
 * optional kicker, large display title, optional lede paragraph.
 *
 * The single primitive enforces consistent rhythm and typography across the
 * page, so adjusting heading size or spacing once propagates everywhere.
 *
 * @module components/vuzora/ui/SectionHeader
 */

import type { ReactNode } from "react";
import { Kicker } from "./Kicker";
import { useReveal } from "@/hooks/use-reveal";


/**
 * Props for {@link SectionHeader}.
 *
 * @property kicker      Small eyebrow text above the title (optional).
 * @property kickerDot   Show a leading amber dot inside the kicker.
 * @property kickerTone  Kicker colour tone; defaults to `"amber"`.
 * @property title       The display heading (`<h2>`).
 * @property lede        Supporting paragraph rendered to the right (on
 *                       `between` layouts) or below (on `left` layouts).
 * @property align       `"between"` (default): title + lede on opposite ends
 *                       on desktop. `"left"`: stacked, left-aligned.
 * @property titleMaxCh  `max-width` of the title in `ch` units. Tune per
 *                       section so balance wrap looks intentional.
 * @property className   Extra classes appended to the outer wrapper.
 * @property theme       `"dark"` (default) for ink surfaces;
 *                       `"light"` for cream/mist surfaces (HowItWorks).
 */
type Props = {
  kicker?: ReactNode;
  kickerDot?: boolean;
  kickerTone?: "amber" | "muted";
  title: ReactNode;
  lede?: ReactNode;
  align?: "left" | "between";
  titleMaxCh?: number;
  className?: string;
  theme?: "dark" | "light";
};

/** Render a kicker + title (+ optional lede) header block. */

export function SectionHeader({
  kicker,
  kickerDot,
  kickerTone = "amber",
  title,
  lede,
  align = "between",
  titleMaxCh = 18,
  className = "",
  theme = "dark",
}: Props) {
  const titleColor = theme === "dark" ? "text-white" : "text-ink";
  const ledeColor = theme === "dark" ? "text-white/55" : "text-ink/65";
  const ref = useReveal<HTMLDivElement>();

  return (
    <div
      ref={ref}
      data-motion-surface="reveal"
      className={`reveal mb-14 flex flex-col gap-6 ${
        align === "between" ? "md:flex-row md:items-end md:justify-between" : "items-start"
      } ${className}`}
    >

      <div>
        {kicker && (
          <Kicker dot={kickerDot} tone={kickerTone} className="mb-4">
            {kicker}
          </Kicker>
        )}
        <h2
          className={`font-display ${titleColor}`}
          style={{
            fontSize: "clamp(2rem, 4.5vw, 3.25rem)",
            lineHeight: 1.0,
            fontWeight: 700,
            letterSpacing: "-0.035em",
            textWrap: "balance",
            maxWidth: `${titleMaxCh}ch`,
          }}
        >
          {title}
        </h2>
      </div>
      {lede && (
        <p className={`max-w-[42ch] text-base leading-relaxed ${ledeColor}`}>{lede}</p>
      )}
    </div>
  );
}
