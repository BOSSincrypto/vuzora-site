/**
 * /changelog – public history of Vuzora releases.
 *
 * Renders {@link CHANGELOG} as a vertical timeline. Source of truth lives in
 * `src/content/changelog.ts` – append a new entry there to update the page.
 *
 * @module routes/changelog
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { NavBar } from "@/components/vuzora/NavBar";
import { Footer } from "@/components/vuzora/Footer";
import { Kicker } from "@/components/vuzora/ui/Kicker";
import { CHANGELOG, formatEntryDate } from "@/content/changelog";
import { BRAND, abs, SITE_URL } from "@/content/vuzora";
import { DISCOVERY_LINKS, INDEXABLE_META } from "@/content/seo";
import ogCover from "@/assets/og-cover.jpg";

const PAGE_TITLE = `Что нового – ${BRAND.name}`;
const PAGE_DESC = "Публичная история изменений Vuzora: что добавили в бот, на сайт и в подписку.";

export const Route = createFileRoute("/changelog")({
  head: () => ({
    meta: [
      { title: PAGE_TITLE },
      { name: "description", content: PAGE_DESC },
      { property: "og:title", content: PAGE_TITLE },
      { property: "og:description", content: PAGE_DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: abs("/changelog") },
      { property: "og:image", content: abs(ogCover) },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: PAGE_TITLE },
      { name: "twitter:description", content: PAGE_DESC },
      { name: "twitter:image", content: abs(ogCover) },
      ...INDEXABLE_META,
    ],
    links: [{ rel: "canonical", href: abs("/changelog") }, ...DISCOVERY_LINKS],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "@id": "https://vuzora.ru/changelog#breadcrumb",
          name: PAGE_TITLE,
          url: abs("/changelog"),
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Главная", item: `${SITE_URL}/` },
            { "@type": "ListItem", position: 2, name: "Что нового", item: abs("/changelog") },
          ],
        }),
      },
    ],
  }),
  component: ChangelogPage,
});

function ChangelogPage() {
  return (
    <div className="grain min-h-screen bg-ink text-white">
      <NavBar />
      <main className="px-6 pt-28 pb-20 md:px-12 md:pt-32 md:pb-28">
        <section className="mx-auto max-w-2xl">
          <Kicker tone="amber">История изменений</Kicker>
          <h1
            className="mt-3 font-display text-white"
            style={{
              fontSize: "clamp(2rem, 4.5vw, 3.25rem)",
              lineHeight: 1.05,
              fontWeight: 800,
              letterSpacing: "-0.035em",
              textWrap: "balance",
            }}
          >
            Что нового
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-white/70">
            Каждое заметное обновление Vuzora – здесь. Без маркетинговых анонсов: просто список
            того, что поменялось и когда.
          </p>

          <ol className="mt-12 space-y-10 border-l border-white/10 pl-6">
            {CHANGELOG.map((e) => (
              <li key={e.date + e.title} className="relative">
                <span
                  aria-hidden="true"
                  className="absolute -left-[31px] top-2 h-2.5 w-2.5 rounded-full bg-amber shadow-[0_0_10px_rgba(255,176,32,0.65)]"
                />
                <div className="flex items-baseline gap-3 font-mono text-[11px] uppercase tracking-[0.2em] text-white/40">
                  <time dateTime={e.date}>{formatEntryDate(e.date)}</time>
                  <span className="rounded-full border border-white/15 px-2 py-0.5 text-white/55">
                    {e.tag}
                  </span>
                </div>
                <h2 className="mt-3 font-display text-xl font-bold text-white md:text-2xl">
                  {e.title}
                </h2>
                <ul className="mt-3 space-y-1.5 text-[15px] leading-relaxed text-white/75">
                  {e.bullets.map((b, i) => (
                    <li key={i}>– {b}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>

          <div className="mt-14 text-sm text-white/45">
            <Link to="/" className="hover:text-white">
              ← На главную
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
