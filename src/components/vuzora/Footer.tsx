/**
 * Site-wide footer: brand lockup, secondary links, and legal/entity block.
 *
 * Extracted from `CallToWake.tsx` so each file owns one responsibility.
 *
 * @module components/vuzora/Footer
 */

import { Logo, Wordmark } from "./Logo";
import { BRAND, LINKS } from "@/content/vuzora";

/** Cached at module load — the year is read-only display data. */
/** Hardcoded to avoid SSR/CSR hydration drift between Worker and browser clocks. */
const CURRENT_YEAR = 2026;

/** Render the global page footer. */
export function Footer() {
  return (
    <footer className="px-6 py-12 md:px-12 md:py-16">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-end">
          <div>
            <div className="flex items-center gap-2.5">
              <Logo size={28} />
              <Wordmark />
            </div>
            <p className="mt-4 max-w-[36ch] text-sm text-white/55">{BRAND.tagline}</p>
          </div>
          <nav
            aria-label="Дополнительные ссылки"
            className="grid grid-cols-2 gap-x-12 gap-y-2 font-mono text-xs text-white/60"
          >
            <a
              href={LINKS.botUrl}
              data-cta="bot-navigation"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white"
            >
              {LINKS.botHandle}
            </a>
            <a href="/pricing" className="hover:text-white">
              Тарифы
            </a>
            <a href={`mailto:${BRAND.email}`} className="hover:text-white">
              {BRAND.email}
            </a>
            <a href={BRAND.legal.termsUrl} className="hover:text-white">
              Публичная оферта
            </a>
            <a href="/unis" className="hover:text-white">
              Поддерживаемые вузы
            </a>
            <a href={BRAND.legal.privacyUrl} className="hover:text-white">
              Политика конфиденциальности
            </a>
            <a href="/blog" className="hover:text-white">
              Блог
            </a>
            <a href="/changelog" className="hover:text-white">
              Что нового
            </a>
          </nav>

        </div>
        <div className="mt-12 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs text-white/55 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1 font-mono">
            <p>
              {BRAND.legal.entity} · ИНН {BRAND.legal.inn} · {BRAND.legal.city}
            </p>
            <p>{BRAND.legal.disclaimer}</p>
          </div>
          <span className="font-mono text-white/40">
            © {CURRENT_YEAR} {BRAND.name}
          </span>
        </div>
      </div>
    </footer>
  );
}
