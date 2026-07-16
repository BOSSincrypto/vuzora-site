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
import { UNIVERSITIES, abs, SITE_URL } from "@/content/vuzora";
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
              name: u.name,
              address: u.city,
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
        <h1 className="sr-only">Поддерживаемые вузы</h1>
        <Universities />
      </main>
      <Footer />
    </div>
  );
}
