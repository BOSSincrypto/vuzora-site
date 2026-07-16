/**
 * Site-level constants: brand, canonical origin, external links.
 *
 * @module content/site
 */

/** Brand info used by the footer, JSON-LD `publisher`, and meta tags. */
export const BRAND = {
  name: "Vuzora",
  tagline: "Vuzora — расписание вуза, которое приходит само, в удобное тебе утро.",
  email: "vuzora.ru@gmail.com",
  legal: {
    entity: "ИП Лысов И.В.",
    inn: "773437258289",
    city: "г. Москва",
    disclaimer: "Сервис не является официальным сервисом вузов.",
    termsUrl: "/legal/terms",
    privacyUrl: "/legal/privacy",
    revision: "27.06.2026",
  },
} as const;

/** Canonical production origin (no trailing slash). */
export const SITE_URL = "https://vuzora.ru";

/** Build an absolute URL from a site-relative path. */
export const abs = (path: string) =>
  path.startsWith("http") ? path : `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;

/** External Telegram destinations. */
export const LINKS = {
  botUrl: "https://t.me/vuzora_bot",
  botHandle: "@vuzora_bot",
  supportBotUrl: "https://t.me/vuzora_support_bot",
  supportHandle: "@vuzora_support_bot",
} as const;
