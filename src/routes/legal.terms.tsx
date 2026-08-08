/**
 * Публичная оферта Vuzora.
 *
 * Текст живёт в `src/content/legal.ts` — оттуда же генерируется
 * `/legal/terms.md`. Здесь только метаданные роута.
 *
 * @module routes/legal.terms
 */

import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/vuzora/LegalPage";
import { TERMS } from "@/content/legal";
import { abs, SITE_URL } from "@/content/vuzora";
import { DISCOVERY_LINKS, INDEXABLE_META, markdownAlternateLink } from "@/content/seo";
import ogCover from "@/assets/og-cover.jpg";

const SOCIAL_DESCRIPTION =
  "Условия оказания услуг сервиса Vuzora: подписка, оплата, возврат средств.";

export const Route = createFileRoute("/legal/terms")({
  head: () => ({
    meta: [
      { title: TERMS.title },
      { name: "description", content: TERMS.description },
      { property: "og:title", content: TERMS.title },
      { property: "og:description", content: SOCIAL_DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: abs(TERMS.path) },
      { property: "og:image", content: abs(ogCover) },
      { property: "og:image:width", content: "1216" },
      { property: "og:image:height", content: "640" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TERMS.title },
      { name: "twitter:description", content: SOCIAL_DESCRIPTION },
      { name: "twitter:image", content: abs(ogCover) },
      ...INDEXABLE_META,
    ],

    links: [
      { rel: "canonical", href: abs(TERMS.path) },
      ...DISCOVERY_LINKS,
      markdownAlternateLink(TERMS.path),
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "@id": "https://vuzora.ru/legal/terms/#breadcrumb",
          name: TERMS.title,
          url: abs(TERMS.path),
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Главная", item: `${SITE_URL}/` },
            { "@type": "ListItem", position: 2, name: "Оферта", item: abs(TERMS.path) },
          ],
        }),
      },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return <LegalPage document={TERMS} />;
}
