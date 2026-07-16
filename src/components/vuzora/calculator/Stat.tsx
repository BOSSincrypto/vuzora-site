/**
 * Stat — single big-number + unit pair used inside the Calculator result card.
 * Kept tiny on purpose so the parent stays declarative.
 */
export interface StatProps {
  value: string;
  unit: string;
}

export function Stat({ value, unit }: StatProps) {
  return (
    <div>
      <div
        className="font-display tabular text-white"
        style={{
          fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)",
          lineHeight: 1,
          fontWeight: 700,
          letterSpacing: "-0.03em",
        }}
      >
        {value}
      </div>
      <div className="mt-1 text-xs uppercase tracking-[0.18em] text-white/45">{unit}</div>
    </div>
  );
}
