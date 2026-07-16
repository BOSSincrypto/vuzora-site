/**
 * Single subscription plan card.
 *
 * Renders one entry from {@link PLANS} — period label, formatted price, hint
 * copy, and an "Выгодно" badge for the featured tier.
 *
 * @module components/vuzora/pricing/PlanCard
 */

import { Kicker } from "../ui/Kicker";
import { formatPrice, type Plan } from "@/content/vuzora";

/** Render one tile of the pricing grid. */
export function PlanCard({ plan }: { plan: Plan }) {
  const { featured, period, price, hint } = plan;
  return (
    <div
      className={`lift relative flex flex-col justify-between rounded-2xl border p-6 transition-colors ${
        featured
          ? "border-amber/50 bg-amber/[0.06]"
          : "border-white/10 bg-ink-soft/40 hover:border-white/20"
      }`}
    >
      {featured && (
        <span className="absolute right-4 top-4">
          <Kicker tone="amber">Выгодно</Kicker>
        </span>
      )}
      <div>
        <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/55">
          {period}
        </div>
        <div className="mt-4 flex items-baseline gap-1.5">
          <span
            className={`tabular font-display ${featured ? "text-amber" : "text-white"}`}
            style={{
              fontSize: "clamp(2rem, 3.5vw, 2.75rem)",
              fontWeight: 700,
              letterSpacing: "-0.04em",
              lineHeight: 1,
            }}
          >
            {formatPrice(price)}
          </span>
          <span className="text-sm text-white/55">₽</span>
        </div>
      </div>
      <p className="mt-4 text-sm text-white/65">{hint}</p>
    </div>
  );
}
