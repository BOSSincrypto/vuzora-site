/**
 * Публичная оферта Vuzora. Каркас под редактирование владельцем.
 * Содержимое можно править прямо в JSX без изменения структуры роута.
 *
 * @module routes/legal.terms
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { BRAND, LINKS, PLANS, formatPrice, abs, SITE_URL } from "@/content/vuzora";
import ogCover from "@/assets/og-cover.jpg";

export const Route = createFileRoute("/legal/terms")({
  head: () => ({
    meta: [
      { title: "Публичная оферта – Vuzora" },
      {
        name: "description",
        content:
          "Условия оказания услуг сервиса Vuzora: подписка, оплата, возврат средств и ответственность сторон.",
      },
      { property: "og:title", content: "Публичная оферта – Vuzora" },
      {
        property: "og:description",
        content: "Условия оказания услуг сервиса Vuzora: подписка, оплата, возврат средств.",
      },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "ru_RU" },
      { property: "og:url", content: abs("/legal/terms") },
      { property: "og:image", content: abs(ogCover) },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Публичная оферта – Vuzora" },
      {
        name: "twitter:description",
        content: "Условия оказания услуг сервиса Vuzora: подписка, оплата, возврат средств.",
      },
      { name: "twitter:image", content: abs(ogCover) },
      { name: "robots", content: "index, follow" },
    ],

    links: [{ rel: "canonical", href: abs("/legal/terms") }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "@id": "https://vuzora.ru/legal/terms#breadcrumb",
          name: "Публичная оферта – Vuzora",
          url: abs("/legal/terms"),
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Главная", item: `${SITE_URL}/` },
            { "@type": "ListItem", position: 2, name: "Оферта", item: abs("/legal/terms") },
          ],
        }),
      },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-20 md:px-10 md:py-28 text-white/85">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/55">
        <Link to="/" className="hover:text-white">
          ← На главную
        </Link>
      </p>
      <h1 className="mt-4 font-display text-3xl font-semibold text-white md:text-4xl">
        Публичная оферта
      </h1>
      <p className="mt-2 font-mono text-xs text-white/55">Редакция от {BRAND.legal.revision}</p>

      <Section title="1. Стороны">
        <p>
          {BRAND.legal.entity}, ИНН {BRAND.legal.inn}, {BRAND.legal.city}
          {" – далее «Исполнитель». Любое физическое лицо, активировавшее"}
          {" подписку в Telegram-боте "}
          <a
            className="underline"
            href={LINKS.botUrl}
            data-cta="bot-navigation"
            target="_blank"
            rel="noopener noreferrer"
          >
            {LINKS.botHandle}
          </a>
          {" – далее «Пользователь»."}
        </p>
      </Section>

      <Section title="2. Предмет">
        <p>
          Исполнитель предоставляет доступ к Telegram-боту Vuzora, который ежедневно публикует
          расписание занятий пользователя на основе открытых данных вузов. {BRAND.legal.disclaimer}
        </p>
      </Section>

      <Section title="3. Подписка и оплата">
        <p>
          Стоимость и срок действия тарифов указаны на странице{" "}
          <Link to="/pricing" className="underline">
            «Тарифы»
          </Link>{" "}
          и являются неотъемлемой частью оферты. Действующие тарифы на момент редакции:
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
          {PLANS.map((p) => (
            <li key={p.id}>
              {p.period} – {formatPrice(p.price)} ₽
            </li>
          ))}
        </ul>
        <p className="mt-3">
          Оплата подписки – единовременным платежом, без автоматического продления. Услуга считается
          оказанной с момента активации доступа в боте.
        </p>
      </Section>

      <Section title="4. Возврат средств">
        <p>
          Возврат полной стоимости подписки возможен в течение 14 календарных дней с момента оплаты,
          если Пользователь не получил ни одной доставки расписания по вине Исполнителя. По
          истечении 14 дней либо при штатной работе сервиса возврат осуществляется пропорционально
          неиспользованному сроку подписки.
        </p>
        <p className="mt-2">
          Заявка на возврат направляется на{" "}
          <a className="underline" href={`mailto:${BRAND.email}`}>
            {BRAND.email}
          </a>{" "}
          с указанием Telegram-аккаунта и даты оплаты. Срок рассмотрения – до 10 рабочих дней.
        </p>
      </Section>

      <Section title="5. Ответственность">
        <p>
          Исполнитель не несёт ответственности за изменения расписания на стороне вуза, временную
          недоступность официальных систем вузов и за решения, принятые Пользователем на основе
          полученной информации.
        </p>
      </Section>

      <Section title="6. Контакты">
        <p>
          {BRAND.legal.entity} · ИНН {BRAND.legal.inn} · {BRAND.legal.city}
          <br />
          Электронная почта:{" "}
          <a className="underline" href={`mailto:${BRAND.email}`}>
            {BRAND.email}
          </a>
          <br />
          Поддержка в Telegram:{" "}
          <a
            className="underline"
            href={LINKS.supportBotUrl}
            data-cta="support"
            target="_blank"
            rel="noopener noreferrer"
          >
            {LINKS.supportHandle}
          </a>
        </p>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-xl font-semibold text-white">{title}</h2>
      <div className="mt-3 space-y-2 text-sm leading-relaxed">{children}</div>
    </section>
  );
}
