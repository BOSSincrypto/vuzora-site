/**
 * Telegram-glyph icon link.
 *
 * Compact round button used in the mobile navbar slot. The desktop CTA is a
 * full pill-shaped button — this is the icon-only variant for narrow widths.
 *
 * @module components/vuzora/nav/TelegramIconLink
 */

import { LINKS } from "@/content/vuzora";

/** Round Telegram link rendered as a 40px white circle with the paper-plane glyph. */
export function TelegramIconLink({ className = "" }: { className?: string }) {
  return (
    <a
      href={LINKS.botUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Открыть в Telegram"
      className={`grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-ink transition-transform active:scale-[0.97] ${className}`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.24 3.64 11.95c-.88-.25-.89-.86.2-1.3L19.07 4.7c.73-.33 1.43.18 1.15 1.3l-2.61 12.3c-.19.91-.74 1.13-1.5.71L12 16.06l-1.99 1.93c-.23.23-.42.42-.86.42z" />
      </svg>
    </a>
  );
}
