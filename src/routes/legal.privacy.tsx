/**
 * Политика обработки персональных данных Vuzora.
 *
 * Текст живёт в `src/content/legal.ts` — оттуда же генерируется
 * `/legal/privacy.md`. Здесь только метаданные роута.
 *
 * @module routes/legal.privacy
 */

import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/vuzora/LegalPage";
import { PRIVACY } from "@/content/legal";
import { abs, SITE_URL } from "@/content/vuzora";
import { DISCOVERY_LINKS, INDEXABLE_META, markdownAlternateLink } from "@/content/seo";
import ogCover from "@/assets/og-cover.jpg";

const SOCIAL_DESCRIPTION = "Какие персональные данные собирает Vuzora и как с ними обращается.";

export const Route = createFileRoute("/legal/privacy")({
  head: () => ({
    meta: [
      { title: PRIVACY.title },
      { name: "description", content: PRIVACY.description },
      { property: "og:title", content: PRIVACY.title },
      { property: "og:description", content: SOCIAL_DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: abs(PRIVACY.path) },
      { property: "og:image", content: abs(ogCover) },
      { property: "og:image:width", content: "1216" },
      { property: "og:image:height", content: "640" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: PRIVACY.title },
      { name: "twitter:description", content: SOCIAL_DESCRIPTION },
      { name: "twitter:image", content: abs(ogCover) },
      ...INDEXABLE_META,
    ],

    links: [
      { rel: "canonical", href: abs(PRIVACY.path) },
      ...DISCOVERY_LINKS,
      markdownAlternateLink(PRIVACY.path),
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "@id": "https://vuzora.ru/legal/privacy/#breadcrumb",
          name: PRIVACY.title,
          url: abs(PRIVACY.path),
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Главная", item: `${SITE_URL}/` },
            {
              "@type": "ListItem",
              position: 2,
              name: "Конфиденциальность",
              item: abs(PRIVACY.path),
            },
          ],
        }),
      },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return <LegalPage document={PRIVACY} />;
}
