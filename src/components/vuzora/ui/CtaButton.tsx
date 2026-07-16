/**
 * Reusable call-to-action anchor used for every primary/secondary button on
 * the Vuzora landing page. It's always rendered as an `<a>` (never a
 * `<button>`) because every action navigates somewhere — internal anchor,
 * Telegram bot, mailto.
 *
 * @module components/vuzora/ui/CtaButton
 */

import type { ReactNode, AnchorHTMLAttributes } from "react";

/** Visual variants. Add new keys to {@link STYLES} when extending. */
type Variant = "primary" | "white" | "ghost" | "link";

/**
 * Props for {@link CtaButton}. Extends the native anchor props so any
 * standard attribute (`href`, `aria-*`, `data-*`, …) just works.
 *
 * @property variant   Visual style. Defaults to `"primary"`.
 * @property arrow     When `true` (default) appends an animated `→` glyph.
 * @property external  When `true` (default) adds `target="_blank"` plus
 *                     `rel="noopener noreferrer"`. Set to `false` for
 *                     in-page hash links.
 */
type Props = AnchorHTMLAttributes<HTMLAnchorElement> & {
  children: ReactNode;
  variant?: Variant;
  arrow?: boolean;
  external?: boolean;
};

/** Tailwind class strings keyed by variant. Kept outside the component so
 *  the object identity is stable across renders. */
const STYLES: Record<Variant, string> = {
  primary:
    "inline-flex items-center gap-2 rounded-full bg-violet px-6 py-3.5 text-sm font-medium text-white shadow-sm transition-all duration-200 ease-out hover:bg-violet-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber active:translate-y-px",
  white:
    "inline-flex items-center gap-2 rounded-full bg-white px-7 py-4 text-base font-medium text-ink transition-all duration-200 ease-out hover:bg-mist focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber active:translate-y-px",
  ghost:
    "inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-2.5 text-sm text-white transition-colors hover:border-amber hover:text-amber focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber",
  link:
    "inline-flex items-center gap-1 text-sm text-white/60 underline decoration-white/20 decoration-1 underline-offset-4 transition-colors hover:text-white hover:decoration-amber focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber rounded-sm",
};

/**
 * Renders a styled anchor with optional trailing arrow and safe external
 * link attributes.
 */

export function CtaButton({
  children,
  variant = "primary",
  arrow = true,
  external = true,
  className = "",
  ...rest
}: Props) {
  return (
    <a
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={`group ${STYLES[variant]} ${className}`}
      {...rest}
    >
      {children}
      {arrow && (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="transition-transform group-hover:translate-x-0.5"
          aria-hidden
        >
          <path d="M5 12h14M13 5l7 7-7 7" />
        </svg>
      )}
    </a>
  );
}
