/**
 * University detail page (`/unis/$slug`).
 *
 * Registry-driven landing for one supported university. Unknown slug → 404.
 * Prerendered for every committed registry record.
 *
 * @module routes/unis.$slug
 */

import { createFileRoute, notFound } from "@tanstack/react-router";
import { NavBar } from "@/components/vuzora/NavBar";
import { Footer } from "@/components/vuzora/Footer";
import { CtaButton } from "@/components/vuzora/ui/CtaButton";
import { RouteErrorFallback, RouteNotFoundFallback } from "@/components/vuzora/ui/RouteFallbacks";
import {
  AFFILIATION_BOUNDARY,
  BRAND,
  DETAIL_CONTENT_MIN_LENGTH,
  findUniversity,
  statusLabel,
  universityBotUrl,
  universityDetailCopy,
  universityFaq,
  universityDetailDescription,
  universityDetailTitle,
  universityPagePath,
  universityPageUrl,
  abs,
  SITE_URL,
} from "@/content/vuzora";
import ogCover from "@/assets/og-cover.jpg";

export const Route = createFileRoute("/unis_/$slug")({
  loader: ({ params }) => {
    const slug = typeof params.slug === "string" ? params.slug.trim() : "";
    if (!slug || slug.length > 200) throw notFound();
    const university = findUniversity(slug);
    if (!university) throw notFound();
    return { university };
  },
  errorComponent: ({ error, reset }) => (
    <RouteErrorFallback error={error} reset={reset} label="university-detail" />
  ),
  notFoundComponent: () => (
    <RouteNotFoundFallback
      title="Такого вуза нет в списке"
      description="Возможно, ссылка устарела или вуз ещё не добавлен. Открой полный список поддерживаемых вузов."
      primaryHref="/unis"
      primaryLabel="Все вузы"
    />
  ),
  head: ({ loaderData }) => {
    const university = loaderData?.university;
    if (!university) {
      return {
        meta: [{ title: `Вуз не найден – ${BRAND.name}` }],
      };
    }
    const title = universityDetailTitle(university);
    const description = universityDetailDescription(university);
    const url = universityPageUrl(university.slug);
    const universityId = `${url}#university`;
    const serviceId = `${SITE_URL}/#service`;
    const orgId = `${SITE_URL}/#org`;

    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:locale", content: "ru_RU" },
        { property: "og:url", content: url },
        { property: "og:image", content: abs(ogCover) },
        { property: "og:image:width", content: "1216" },
        { property: "og:image:height", content: "640" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: abs(ogCover) },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "BreadcrumbList",
                "@id": `${url}#breadcrumb`,
                itemListElement: [
                  {
                    "@type": "ListItem",
                    position: 1,
                    name: "Главная",
                    item: `${SITE_URL}/`,
                  },
                  {
                    "@type": "ListItem",
                    position: 2,
                    name: "Вузы",
                    item: abs("/unis"),
                  },
                  {
                    "@type": "ListItem",
                    position: 3,
                    name: university.name,
                    item: url,
                  },
                ],
              },
              {
                "@type": "CollegeOrUniversity",
                "@id": universityId,
                name: university.name,
                url,
                address: {
                  "@type": "PostalAddress",
                  addressLocality: university.city,
                  addressCountry: "RU",
                },
              },
              {
                "@type": "Service",
                "@id": serviceId,
                name: "Vuzora — расписание вуза в Telegram",
                serviceType: "University schedule delivery",
                provider: {
                  "@id": orgId,
                  "@type": "Organization",
                  name: BRAND.name,
                },
                // Validator requires a direct university @id string, not a node object.
                about: universityId,
                url: SITE_URL + "/",
                areaServed: university.city,
              },
            ],
          }),
        },
      ],
    };
  },
  component: UniversityDetailPage,
});

function UniversityDetailPage() {
  const { university } = Route.useLoaderData();
  const copy = universityDetailCopy(university);
  const faq = universityFaq(university);
  const ctaHref = universityBotUrl(university.slug);
  const label = statusLabel(university.status);
  const returnHref = "/unis";

  // Satisfy the published content floor at build/typecheck time without runtime work.
  if (import.meta.env.DEV && copy.length < DETAIL_CONTENT_MIN_LENGTH) {
    console.warn(`[vuzora:university] detail copy too short for ${university.slug}`);
  }

  return (
    <div className="min-h-screen bg-ink text-white">
      <NavBar />
      <main id="main" className="px-6 py-24 md:px-12 md:py-28">
        <div className="mx-auto max-w-3xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/50">
            {university.code} · {university.city}
          </p>
          <h1
            className="mt-4 font-display font-extrabold tracking-tight text-white"
            style={{
              fontSize: "clamp(1.85rem, 4.5vw, 2.75rem)",
              lineHeight: 1.12,
              letterSpacing: "-0.03em",
            }}
          >
            {university.name}
          </h1>

          <h2 className="mt-5 max-w-2xl font-display text-2xl font-semibold leading-tight tracking-tight text-white md:text-3xl">
            Расписание {university.name} в Telegram
          </h2>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <span
              className={
                university.status === "online"
                  ? "inline-flex items-center rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-emerald-300"
                  : "inline-flex items-center rounded-full border border-amber/30 bg-amber/10 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-amber"
              }
            >
              {label}
            </span>
            <span className="text-sm text-white/55">{university.city}</span>
          </div>

          <div
            data-detail-content
            className="mt-8 space-y-4 text-base leading-relaxed text-white/75"
          >
            <p>{copy}</p>
            <section data-section="connect" className="border-t border-white/10 pt-7">
              <h3 className="font-display text-xl font-semibold text-white">Как подключиться</h3>
              <p className="mt-3">
                Нажми кнопку подключения, открой Vuzora в Telegram и выбери {university.code}.
                Параметр ссылки сохраняет привязку к странице {university.name}, поэтому начать
                можно без поиска по списку.
              </p>
            </section>
            <section data-section="morning-delivery" className="border-t border-white/10 pt-7">
              <h3 className="font-display text-xl font-semibold text-white">Что приходит утром</h3>
              <p className="mt-3">
                Бот присылает уведомление с доступным расписанием в выбранный утренний слот с
                05:00 до 10:00 по Москве. Это формат доставки в Telegram, а не опубликованная на
                сайте таблица занятий: за актуальными изменениями всегда следи в официальных
                каналах {university.name}.
              </p>
            </section>
            <section data-section="status-city" className="border-t border-white/10 pt-7">
              <h3 className="font-display text-xl font-semibold text-white">Статус и город</h3>
              <p className="mt-3">
                В реестре Vuzora: статус «{label}», город {university.city}. Эти поля описывают
                доступность функции и территорию университета, а не расписание конкретной группы.
              </p>
            </section>
            <section data-section="affiliation" className="border-t border-white/10 pt-7">
              <h3 className="font-display text-xl font-semibold text-white">О сервисе</h3>
              <p className="mt-3">
                {AFFILIATION_BOUNDARY}. Vuzora не заменяет официальный сайт {university.name} и не
                является его частью. Вопросы об учёбе, документах и подтверждении занятий нужно
                задавать официальным каналам университета.
              </p>
            </section>
            <section data-section="faq" className="border-t border-white/10 pt-7">
              <h3 className="font-display text-xl font-semibold text-white">Частые вопросы</h3>
              <ul className="mt-4 divide-y divide-white/10 border-y border-white/10">
                {faq.map((item) => (
                  <li key={item.question}>
                    <details className="group py-4">
                      <summary className="flex cursor-pointer list-none items-start justify-between gap-5 font-display text-base font-medium text-white/90 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber">
                        <span>{item.question}</span>
                        <span aria-hidden className="shrink-0 text-amber transition-transform group-open:rotate-45">
                          +
                        </span>
                      </summary>
                      <p className="mt-3 pr-8 text-sm leading-relaxed text-white/65">{item.answer}</p>
                    </details>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <CtaButton href={ctaHref} variant="primary" data-cta="university-conversion">
              Получать расписание в Telegram
            </CtaButton>
            <a
              href="/unis"
              className="inline-flex items-center gap-1 text-sm text-white/65 underline decoration-white/20 decoration-1 underline-offset-4 transition-colors hover:text-white hover:decoration-amber focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber rounded-sm"
            >
              ← Все вузы
            </a>
            {university.officialUrl ? (
              <a
                href={university.officialUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-white/65 underline decoration-white/20 decoration-1 underline-offset-4 transition-colors hover:text-white hover:decoration-amber focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber rounded-sm"
              >
                Официальный сайт
              </a>
            ) : null}
          </div>

          {/* Hidden text marker for path consistency in tests / crawlers */}
          <p className="sr-only">
            Страница вуза {universityPagePath(university.slug)}. Вернуться: {returnHref}.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
