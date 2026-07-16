/**
 * Decorative 28-day calendar mock used inside the largest bento cell.
 *
 * Purely visual — no real dates. A fixed pattern of "scheduled" days plus a
 * single highlighted "today" cell communicates the interactive-calendar
 * feature without pulling a real date library into the bundle.
 *
 * @module components/vuzora/features/CalendarPreview
 */

/** Indexes (0–27) of cells rendered as "has classes". */
const SCHEDULED_DAYS = new Set([3, 4, 5, 9, 10, 11, 12, 16, 17, 18, 19, 23, 24, 25]);
/** Index of the highlighted "today" cell. */
const TODAY_INDEX = 12;

/** 7×4 grid of stylized day chips. */
export function CalendarPreview() {
  return (
    <div className="tabular mt-8 grid grid-cols-7 gap-1.5 font-mono text-[11px]">
      {Array.from({ length: 28 }).map((_, i) => {
        const isToday = i === TODAY_INDEX;
        const has = SCHEDULED_DAYS.has(i);
        return (
          <div
            key={i}
            className={`flex h-10 items-center justify-center rounded-md border ${
              isToday
                ? "border-amber bg-amber/15 text-amber"
                : has
                  ? "border-white/10 bg-white/[0.04] text-white/85"
                  : "border-white/5 text-white/40"
            }`}
          >
            {i + 1}
          </div>
        );
      })}
    </div>
  );
}
