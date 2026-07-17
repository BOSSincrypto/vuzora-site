/**
 * Standalone /unis route – shareable, SEO-indexed list of supported
 * universities. Renders the same `<Universities />` component used on
 * the landing page.
 *
 * @module routes/unis
 */

import { createFileRoute } from "@tanstack/react-router";
import { NavBar } from "@/components/vuzora/NavBar";
import { Universities } from "@/components/vuzora/Universities";
import { Footer } from "@/components/vuzora/Footer";
import { AFFILIATION_BOUNDARY, UNIVERSITIES, abs, SITE_URL } from "@/content/vuzora";
import ogCover from "@/assets/og-cover.jpg";

const TITLE = "Поддерживаемые вузы – Vuzora";
const DESCRIPTION =
  "Список вузов, для которых Vuzora уже умеет присылать расписание. Нет твоего вуза – напиши, добавим.";

export const Route = createFileRoute("/unis")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: abs("/unis") },
      { property: "og:image", content: abs(ogCover) },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
      { name: "twitter:image", content: abs(ogCover) },
    ],
    links: [{ rel: "canonical", href: abs("/unis") }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ItemList",
          "@id": "https://vuzora.ru/unis#directory",
          name: TITLE,
          url: abs("/unis"),
          itemListElement: UNIVERSITIES.map((u, i) => ({
            "@type": "ListItem",
            position: i + 1,
            item: {
              "@type": "CollegeOrUniversity",
              "@id": abs(`/unis/${u.slug}#university`),
              name: u.name,
              url: abs(`/unis/${u.slug}`),
              address: {
                "@type": "PostalAddress",
                addressLocality: u.city,
                addressCountry: "RU",
              },
            },
          })),
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "@id": "https://vuzora.ru/unis#breadcrumb",
          name: TITLE,
          url: abs("/unis"),
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Главная", item: `${SITE_URL}/` },
            { "@type": "ListItem", position: 2, name: "Вузы", item: abs("/unis") },
          ],
        }),
      },
    ],
  }),
  component: UnisPage,
});

function UnisPage() {
  return (
    <div className="min-h-screen bg-ink text-white">
      <NavBar />
      <main id="main">
        {/*
          Mobile box model: keep side padding modest and use fluid H1 sizing so
          long single tokens (e.g. «Поддерживаемые») stay within the content
          width at 320px. Fixed text-4xl (36px) + px-6 inflated body.scrollWidth
          to 336 and failed VAL-UNI-018.
        */}
        <section className="px-4 pb-2 pt-24 sm:px-6 md:px-12 md:pb-4 md:pt-32">
          <div className="mx-auto min-w-0 max-w-6xl">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-amber sm:tracking-[0.22em]">
              Каталог Vuzora
            </p>
            <h1
              className="mt-4 max-w-3xl min-w-0 font-display font-bold text-white"
              style={{
                fontSize: "clamp(1.75rem, 7.5vw, 3.75rem)",
                lineHeight: 1.1,
                letterSpacing: "-0.03em",
              }}
            >
              Поддерживаемые вузы
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/65 md:text-lg">
              Выбери университет, чтобы узнать статус подключения и настроить утреннюю доставку
              расписания в Telegram. На странице каждого вуза есть понятный способ начать и ссылка
              обратно в полный каталог. {AFFILIATION_BOUNDARY}.
            </p>
          </div>
        </section>
        <Universities />
      </main>
      <Footer />
    </div>
  );
}
