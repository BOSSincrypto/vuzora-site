/**
 * Vuzora brand mark — purple square + white check tick + amber sunrise dot.
 *
 * The SVG is hand-tuned for crisp rendering at 24–48px (navbar, footer,
 * chat mockup avatar). For larger renderings the stroke widths still hold.
 *
 * @module components/vuzora/Logo
 */

/**
 * Square brand logo.
 * @param size      Pixel width/height of the SVG (default 32).
 * @param className Extra Tailwind classes appended to the root `<svg>`.
 */
export function Logo({
  size = 32,
  className = "",
  decorative = true,
}: {
  size?: number;
  className?: string;
  /**
   * When `true` (default) the SVG is marked `aria-hidden` and role=`img`
   * without a label. Set `false` when the logo is presented **alone**
   * (no accompanying "Vuzora" text) so screen readers still announce it.
   */
  decorative?: boolean;
}) {
  const a11y = decorative
    ? { "aria-hidden": true as const, focusable: false as const }
    : { role: "img" as const, "aria-label": "Vuzora" };
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      {...a11y}
    >
      <rect width="64" height="64" rx="14" fill="#4F3CFF" />
      <path
        d="M14,26 L28,52 L46,18"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="49" cy="14" r="6" fill="#FFB020" />
    </svg>
  );
}


/**
 * Wordmark — the "Vuzora" name in the display typeface.
 * Pair with {@link Logo} for the full brand lockup.
 * @param className Extra Tailwind classes appended to the root span.
 */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`font-display text-[1.25rem] font-bold tracking-tight text-white ${className}`}
    >
      Vuzora
    </span>
  );
}
