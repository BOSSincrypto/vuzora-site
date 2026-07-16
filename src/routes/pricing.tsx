/**
 * Standalone /pricing route – shareable, SEO-indexed version of the
 * Pricing section. Renders the same `<Pricing />` component used on the
 * landing page, wrapped in the global NavBar + Footer chrome.
 *
 * @module routes/pricing
 */

import { createFileRoute } from "@tanstack/react-router";
import { NavBar } from "@/components/vuzora/NavBar";
import { Pricing } from "@/components/vuzora/Pricing";
import { Footer } from "@/components/vuzora/Footer";
import { PLANS, BRAND, abs, SITE_URL } from "@/content/vuzora";
import ogCover from "@/assets/og-cover.jpg";

const TITLE = "Тарифы Vuzora – подписка от 49 ₽";
const DESCRIPTION =
  "Цена подписки на Vuzora: от 49 ₽ за месяц до 599 ₽ за весь срок обучения. Без рекламы и автопродления.";

const prices = PLANS.map((p) => p.price);
const offers = PLANS.map((p) => ({
  "@type": "Offer",
  name: `Vuzora · ${p.period}`,
  price: p.price,
  priceCurrency: "RUB",
  availability: "https://schema.org/InStock",
  url: abs("/pricing"),
  category: "subscription",
}));

const PRICING_LD = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: "Vuzora — подписка",
  description: DESCRIPTION,
  brand: { "@type": "Brand", name: BRAND.name },
  offers: {
    "@type": "AggregateOffer",
    priceCurrency: "RUB",
    lowPrice: Math.min(...prices),
    highPrice: Math.max(...prices),
    offerCount: PLANS.length,
    offers,
  },
};

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: abs("/pricing") },
      { property: "og:image", content: abs(ogCover) },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
      { name: "twitter:image", content: abs(ogCover) },
    ],
    links: [{ rel: "canonical", href: abs("/pricing") }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(PRICING_LD),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Главная", item: `${SITE_URL}/` },
            { "@type": "ListItem", position: 2, name: "Тарифы", item: abs("/pricing") },
          ],
        }),
      },
    ],
  }),
  component: PricingPage,
});

function PricingPage() {
  return (
    <div className="min-h-screen bg-ink text-white">
      <NavBar />
      <main id="main">
        <h1 className="sr-only">Тарифы и подписка Vuzora</h1>
        <Pricing />
      </main>
      <Footer />
    </div>
  );
}
