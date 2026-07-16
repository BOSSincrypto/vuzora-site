/**
 * Blog listing page (`/blog`).
 *
 * Lightweight: cards for every entry in {@link POSTS}, sorted newest first.
 * Uses the global NavBar + Footer for consistency.
 *
 * @module routes/blog.index
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { NavBar } from "@/components/vuzora/NavBar";
import { Footer } from "@/components/vuzora/Footer";
import { Kicker } from "@/components/vuzora/ui/Kicker";
import { POSTS, formatPostDate } from "@/content/blog";
import { BRAND, abs, SITE_URL } from "@/content/vuzora";
import ogCover from "@/assets/og-cover.jpg";

const TITLE = `Блог – ${BRAND.name}`;
const DESCRIPTION =
  "Заметки про утренний ритуал, парсинг расписаний и устройство Vuzora. Без воды и SEO-выжимок.";

export const Route = createFileRoute("/blog/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "ru_RU" },
      { property: "og:url", content: abs("/blog/") },
      { property: "og:image", content: abs(ogCover) },
      { property: "og:image:width", content: "1216" },
      { property: "og:image:height", content: "640" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
      { name: "twitter:image", content: abs(ogCover) },
    ],
    links: [{ rel: "canonical", href: abs("/blog/") }],

    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Blog",
          "@id": `${abs("/blog")}#blog`,
          url: abs("/blog"),
          name: TITLE,
          inLanguage: "ru",
          publisher: { "@id": `${SITE_URL}/#org` },
          blogPost: POSTS.map((p) => ({
            "@type": "BlogPosting",
            headline: p.title,
            datePublished: p.date,
            url: abs(`/blog/${p.slug}`),
            description: p.summary,
          })),
        }),
      },
    ],
  }),
  component: BlogIndex,
});

const SORTED = [...POSTS].sort((a, b) => (a.date < b.date ? 1 : -1));

function BlogIndex() {
  return (
    <div className="grain min-h-screen bg-ink text-white">
      <NavBar />
      <main className="px-6 pt-28 pb-20 md:px-12 md:pt-32 md:pb-28">
        <div className="mx-auto max-w-3xl">
          <Kicker tone="amber">Заметки</Kicker>
          <h1
            className="mt-4 font-display text-white"
            style={{
              fontSize: "clamp(2.25rem, 5vw, 3.5rem)",
              lineHeight: 1.0,
              fontWeight: 800,
              letterSpacing: "-0.035em",
            }}
          >
            Блог Vuzora
          </h1>
          <p className="mt-4 max-w-[55ch] text-base leading-relaxed text-white/65">
            Короткие тексты о том, как устроен бот, почему мы выбираем именно такие решения и что
            меняется с каждым релизом.
          </p>

          <div className="mt-12 divide-y divide-white/10 border-y border-white/10">
            {SORTED.map((p) => (
              <article key={p.slug} className="group py-8">
                <Link
                  to="/blog/$slug"
                  params={{ slug: p.slug }}
                  className="block rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber"
                >
                  <div className="flex items-baseline justify-between gap-4 font-mono text-[11px] uppercase tracking-[0.2em] text-white/40">
                    <time dateTime={p.date}>{formatPostDate(p.date)}</time>
                    <span>{p.readingTime}</span>
                  </div>
                  <h2
                    className="mt-3 font-display text-white transition-colors group-hover:text-amber"
                    style={{
                      fontSize: "clamp(1.5rem, 2.6vw, 2rem)",
                      lineHeight: 1.1,
                      fontWeight: 700,
                      letterSpacing: "-0.025em",
                    }}
                  >
                    {p.title}
                  </h2>
                  <p className="mt-3 max-w-[60ch] text-[15px] leading-relaxed text-white/65">
                    {p.summary}
                  </p>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm text-white/45 transition-colors group-hover:text-amber">
                    Читать
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d="M5 12h14M13 5l7 7-7 7" />
                    </svg>
                  </span>
                </Link>
              </article>
            ))}
          </div>

          <div className="mt-12 text-sm text-white/45">
            <Link to="/" className="hover:text-white">
              ← На главную
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
