/**
 * Blog post detail page (`/blog/$slug`).
 *
 * Renders one post from {@link POSTS}. Unknown slug → 404.
 *
 * @module routes/blog.$slug
 */

import { useMemo } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { NavBar } from "@/components/vuzora/NavBar";
import { Footer } from "@/components/vuzora/Footer";
import { Kicker } from "@/components/vuzora/ui/Kicker";
import { CtaButton } from "@/components/vuzora/ui/CtaButton";
import { ReadProgress } from "@/components/vuzora/ReadProgress";
import { RouteErrorFallback, RouteNotFoundFallback } from "@/components/vuzora/ui/RouteFallbacks";
import { useReadProgress } from "@/hooks/use-read-progress";
import { findPost, formatPostDate, POSTS } from "@/content/blog";
import { BRAND, LINKS, SITE_URL, abs } from "@/content/vuzora";
import ogCover from "@/assets/og-cover.jpg";

export const Route = createFileRoute("/blog/$slug")({
  loader: ({ params }) => {
    // Defensive: malformed slug (empty, oversized) → 404 instead of crash.
    const slug = typeof params.slug === "string" ? params.slug.trim() : "";
    if (!slug || slug.length > 200) throw notFound();
    const post = findPost(slug);
    if (!post) throw notFound();
    return { post };
  },
  errorComponent: ({ error, reset }) => (
    <RouteErrorFallback error={error} reset={reset} label="blog-post" />
  ),
  notFoundComponent: () => (
    <RouteNotFoundFallback
      title="Такой заметки нет"
      description="Возможно, ссылка устарела или пост ещё не опубликован. Загляни в блог – там всё, что мы успели написать."
      primaryHref="/blog"
      primaryLabel="Все записи"
    />
  ),
  head: ({ loaderData }) => {
    const post = loaderData?.post;
    if (!post) {
      return {
        meta: [{ title: `Пост не найден – ${BRAND.name}` }],
      };
    }
    const title = `${post.title} – ${BRAND.name}`;
    const url = abs(`/blog/${post.slug}`);
    return {
      meta: [
        { title },
        { name: "description", content: post.summary },
        { property: "og:title", content: title },
        { property: "og:description", content: post.summary },
        { property: "og:type", content: "website" },
        { property: "og:locale", content: "ru_RU" },
        { property: "og:url", content: url },
        { property: "og:image", content: abs(ogCover) },
        { property: "og:image:width", content: "1216" },
        { property: "og:image:height", content: "640" },
        { property: "article:published_time", content: post.date },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: post.summary },
        { name: "twitter:image", content: abs(ogCover) },
      ],

      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            "@id": `${url}#post`,
            mainEntityOfPage: url,
            url,
            headline: post.title,
            datePublished: post.date,
            dateModified: post.date,
            inLanguage: "ru",
            description: post.summary,
            author: { "@type": "Organization", name: BRAND.name, url: `${SITE_URL}/` },
            publisher: { "@id": `${SITE_URL}/#org` },
          }),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Главная", item: `${SITE_URL}/` },
              { "@type": "ListItem", position: 2, name: "Блог", item: abs("/blog") },
              { "@type": "ListItem", position: 3, name: post.title, item: url },
            ],
          }),
        },
      ],
    };
  },
  component: BlogPost,
});

function BlogPost() {
  const { post } = Route.useLoaderData();
  const { prev, next } = useMemo(() => {
    const idx = POSTS.findIndex((p) => p.slug === post.slug);
    return {
      prev: idx > 0 ? POSTS[idx - 1] : null,
      next: idx >= 0 && idx < POSTS.length - 1 ? POSTS[idx + 1] : null,
    };
  }, [post.slug]);
  const { ref, progress } = useReadProgress<HTMLElement>();

  return (
    <div className="grain min-h-screen bg-ink text-white">
      <ReadProgress progress={progress} />
      <NavBar />
      <main ref={ref} className="px-6 pt-28 pb-20 md:px-12 md:pt-32 md:pb-28">
        <article className="mx-auto max-w-2xl">
          <Kicker tone="amber">Блог</Kicker>
          <div className="mt-3 flex items-baseline justify-between gap-4 font-mono text-[11px] uppercase tracking-[0.2em] text-white/40">
            <time dateTime={post.date}>{formatPostDate(post.date)}</time>
            <span>{post.readingTime}</span>
          </div>
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
            {post.title}
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-white/70">{post.summary}</p>

          <div className="mt-10 space-y-5 text-[17px] leading-[1.7] text-white/80">
            {post.body.map((para: string, i: number) => (
              // Include the slug + index so keys are stable across route
              // transitions between two posts of similar length.
              <p key={`${post.slug}-${i}`}>{para}</p>
            ))}
          </div>

          <div className="mt-14 rounded-2xl border border-white/10 bg-ink-soft/60 p-6">
            <div className="font-display text-lg font-bold text-white">
              Утро без поиска расписания
            </div>
            <p className="mt-2 text-sm text-white/65">
              Vuzora сама присылает пары в Telegram в удобное тебе утро. Бесплатно до 31 октября
              2026.
            </p>
            <div className="mt-4">
              <CtaButton href={LINKS.botUrl} variant="primary">
                Открыть {LINKS.botHandle}
              </CtaButton>
            </div>
          </div>

          <nav
            aria-label="Другие записи"
            className="mt-12 flex items-stretch justify-between gap-4 border-t border-white/10 pt-6 text-sm"
          >
            <div className="flex-1">
              {prev && (
                <Link
                  to="/blog/$slug"
                  params={{ slug: prev.slug }}
                  className="block rounded-lg text-white/55 hover:text-white"
                >
                  <span className="block font-mono text-[10px] uppercase tracking-[0.2em] text-white/35">
                    ← Предыдущая
                  </span>
                  <span className="mt-1 block">{prev.title}</span>
                </Link>
              )}
            </div>
            <div className="flex-1 text-right">
              {next && (
                <Link
                  to="/blog/$slug"
                  params={{ slug: next.slug }}
                  className="block rounded-lg text-white/55 hover:text-white"
                >
                  <span className="block font-mono text-[10px] uppercase tracking-[0.2em] text-white/35">
                    Следующая →
                  </span>
                  <span className="mt-1 block">{next.title}</span>
                </Link>
              )}
            </div>
          </nav>

          <div className="mt-8 text-sm text-white/45">
            <Link to="/blog" className="hover:text-white">
              ← Все записи
            </Link>
          </div>
        </article>
      </main>
      <Footer />
    </div>
  );
}
