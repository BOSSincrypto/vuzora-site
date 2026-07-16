/**
 * Vuzora landing page (`/`).
 *
 * Composes every marketing section in vertical order and wires up SEO:
 *  - `<head>` metadata: title, description, OpenGraph, Twitter, theme-color.
 *  - JSON-LD `SoftwareApplication` graph driven by {@link BRAND},
 *    {@link PLANS}, and {@link UNIVERSITIES} — kept in sync automatically.
 *  - Skip-link target (`#main`) for keyboard users.
 *  - Per-section {@link ErrorBoundary} so a single broken block can't blank
 *    the page.
 *  - `cv-auto` wrappers (CSS `content-visibility: auto`) defer paint/layout
 *    for off-screen sections for faster initial render and smoother scroll.
 *
 * @module routes/index
 */

import { createFileRoute } from "@tanstack/react-router";
import { NavBar } from "@/components/vuzora/NavBar";
import { Hero } from "@/components/vuzora/Hero";
import { MorningLoop } from "@/components/vuzora/MorningLoop";
import { HowItWorks } from "@/components/vuzora/HowItWorks";
import { FeatureBento } from "@/components/vuzora/FeatureBento";
import { Manifest } from "@/components/vuzora/Manifest";
import { Pricing } from "@/components/vuzora/Pricing";
import { Universities } from "@/components/vuzora/Universities";
import { Faq } from "@/components/vuzora/Faq";
import { CallToWake } from "@/components/vuzora/CallToWake";
import { Footer } from "@/components/vuzora/Footer";
import { StickyMobileCta } from "@/components/vuzora/StickyMobileCta";
import { Calculator } from "@/components/vuzora/Calculator";
import { Compare } from "@/components/vuzora/Compare";

import { ErrorBoundary } from "@/components/vuzora/ui/ErrorBoundary";
import { DeferredSection } from "@/components/vuzora/ui/DeferredSection";
import { BRAND, FAQ, LINKS, PLANS, UNIVERSITIES, abs, SITE_URL } from "@/content/vuzora";
import ogCover from "@/assets/og-cover.jpg";

/** Browser-tab title and OpenGraph `og:title`. */
const TITLE = "Vuzora – расписание вуза в Telegram каждое утро";
/** Meta description and OpenGraph `og:description`. */
const DESCRIPTION =
  "Telegram-бот сам присылает расписание твоего вуза каждое утро в удобный тебе слот с 05:00 до 10:00 МСК. Без поиска, без рекламы, без шума.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: SITE_URL + "/" },
      { property: "og:locale", content: "ru_RU" },
      { property: "og:image", content: abs(ogCover) },
      { property: "og:image:width", content: "1216" },
      { property: "og:image:height", content: "640" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
      { name: "twitter:image", content: abs(ogCover) },
    ],
    links: [{ rel: "canonical", href: SITE_URL + "/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: BRAND.name,
          applicationCategory: "EducationalApplication",
          operatingSystem: "Telegram",
          url: LINKS.botUrl,
          inLanguage: "ru",
          description: DESCRIPTION,
          publisher: {
            "@type": "Organization",
            name: BRAND.legal.entity,
            email: BRAND.email,
          },
          offers: PLANS.map((p) => ({
            "@type": "Offer",
            name: p.period,
            price: p.price,
            priceCurrency: "RUB",
            category: "subscription",
            description: p.hint,
          })),
          audience: {
            "@type": "EducationalAudience",
            educationalRole: "student",
          },
          about: UNIVERSITIES.map((u) => ({
            "@type": "CollegeOrUniversity",
            name: u.name,
            address: u.city,
          })),
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQ.map((item) => ({
            "@type": "Question",
            name: item.q,
            acceptedAnswer: { "@type": "Answer", text: item.a },
          })),
        }),
      },
    ],
  }),
  component: Index,
});

/**
 * The landing page component. Order matters — each section is paint-deferred
 * via `cv-auto` until it scrolls near the viewport (except the hero, which
 * paints immediately as the LCP candidate).
 */
function Index() {
  return (
    <div className="grain min-h-screen bg-ink text-white">
      <a href="#main" className="skip-link">
        Перейти к содержимому
      </a>
      <DeferredSection label="nav" defer={false} fallback={null}>
        <NavBar />
      </DeferredSection>
      <main id="main">
        <DeferredSection label="hero" defer={false}><Hero /></DeferredSection>
        <DeferredSection label="morning-loop"><MorningLoop /></DeferredSection>
        <DeferredSection label="how-it-works"><HowItWorks /></DeferredSection>
        <DeferredSection label="features"><FeatureBento /></DeferredSection>
        <DeferredSection label="compare"><Compare /></DeferredSection>
        <DeferredSection label="calculator"><Calculator /></DeferredSection>
        <DeferredSection label="universities"><Universities /></DeferredSection>
        <DeferredSection label="manifest"><Manifest /></DeferredSection>
        <DeferredSection label="pricing"><Pricing /></DeferredSection>
        <DeferredSection label="faq"><Faq /></DeferredSection>
        <DeferredSection label="cta"><CallToWake /></DeferredSection>
        <DeferredSection label="footer" defer={false} fallback={null}>
          <Footer />
        </DeferredSection>
      </main>
      <ErrorBoundary label="sticky-cta" fallback={null}>
        <StickyMobileCta />
      </ErrorBoundary>
    </div>
  );
}
