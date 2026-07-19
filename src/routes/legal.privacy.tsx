/**
 * Политика обработки персональных данных Vuzora.
 * Каркас под 152-ФЗ; владелец дорабатывает фактические практики хранения.
 *
 * @module routes/legal.privacy
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { BRAND, LINKS, abs, SITE_URL } from "@/content/vuzora";
import { DISCOVERY_LINKS, INDEXABLE_META } from "@/content/seo";
import ogCover from "@/assets/og-cover.jpg";

export const Route = createFileRoute("/legal/privacy")({
  head: () => ({
    meta: [
      { title: "Политика конфиденциальности – Vuzora" },
      {
        name: "description",
        content:
          "Какие персональные данные собирает Vuzora, как они хранятся и как пользователь может их удалить.",
      },
      { property: "og:title", content: "Политика конфиденциальности – Vuzora" },
      {
        property: "og:description",
        content: "Какие персональные данные собирает Vuzora и как с ними обращается.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: abs("/legal/privacy") },
      { property: "og:image", content: abs(ogCover) },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Политика конфиденциальности – Vuzora" },
      {
        name: "twitter:description",
        content: "Какие персональные данные собирает Vuzora и как с ними обращается.",
      },
      { name: "twitter:image", content: abs(ogCover) },
      ...INDEXABLE_META,
    ],

    links: [{ rel: "canonical", href: abs("/legal/privacy") }, ...DISCOVERY_LINKS],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "@id": "https://vuzora.ru/legal/privacy#breadcrumb",
          name: "Политика конфиденциальности – Vuzora",
          url: abs("/legal/privacy"),
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Главная", item: `${SITE_URL}/` },
            {
              "@type": "ListItem",
              position: 2,
              name: "Конфиденциальность",
              item: abs("/legal/privacy"),
            },
          ],
        }),
      },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-20 md:px-10 md:py-28 text-white/85">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/55">
        <Link to="/" className="hover:text-white">
          ← На главную
        </Link>
      </p>
      <h1 className="mt-4 font-display text-3xl font-semibold text-white md:text-4xl">
        Политика конфиденциальности
      </h1>
      <p className="mt-2 font-mono text-xs text-white/55">Редакция от {BRAND.legal.revision}</p>

      <Section title="1. Оператор данных">
        <p>
          {BRAND.legal.entity}, ИНН {BRAND.legal.inn}, {BRAND.legal.city}. Связь по вопросам
          персональных данных:{" "}
          <a className="underline" href={`mailto:${BRAND.email}`}>
            {BRAND.email}
          </a>
          .
        </p>
      </Section>

      <Section title="2. Какие данные мы обрабатываем">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Telegram-идентификатор и имя аккаунта (передаются Telegram API при первом запуске бота).
          </li>
          <li>Выбранный вуз, факультет, группа – чтобы знать, какое расписание отправлять.</li>
          <li>Часовой пояс и язык интерфейса – чтобы доставка приходила вовремя.</li>
          <li>Технические логи доставки сообщений – для отладки и сохранения качества сервиса.</li>
        </ul>
        <p className="mt-3">
          Мы не собираем e-mail, номер телефона, фамилию, паспортные данные, геолокацию и платёжные
          реквизиты. Оплата подписки проходит через внешнего платёжного провайдера – см. его
          политику.
        </p>
      </Section>

      <Section title="3. Цели обработки">
        <ul className="list-disc space-y-1 pl-5">
          <li>Ежедневная доставка расписания в Telegram.</li>
          <li>
            Поддержка пользователя в боте{" "}
            <a
              className="underline"
              href={LINKS.supportBotUrl}
              data-cta="support"
              target="_blank"
              rel="noopener noreferrer"
            >
              {LINKS.supportHandle}
            </a>
            .
          </li>
          <li>Учёт активных подписок и сроков их действия.</li>
        </ul>
      </Section>

      <Section title="4. Сроки и хранение">
        <p>
          Данные хранятся, пока активна подписка либо до момента, когда пользователь явно удалит
          аккаунт командой /delete в боте. После удаления данные стираются в течение 30 календарных
          дней, кроме обезличенных агрегированных логов.
        </p>
      </Section>

      <Section title="5. Третьи стороны">
        <ul className="list-disc space-y-1 pl-5">
          <li>Telegram – доставка сообщений (Telegram Privacy Policy).</li>
          <li>Хостинг-провайдер – размещение сервера бота.</li>
          <li>Платёжный провайдер – обработка оплаты подписки.</li>
        </ul>
        <p className="mt-3">
          Vuzora не передаёт данные рекламным сетям и не использует сторонние трекеры на сайте:
          только обезличенная веб-аналитика без cookie.
        </p>
      </Section>

      <Section title="6. Права пользователя">
        <p>
          Пользователь вправе получить копию своих данных, исправить их или удалить, отправив запрос
          на{" "}
          <a className="underline" href={`mailto:${BRAND.email}`}>
            {BRAND.email}
          </a>
          . Срок ответа – до 30 календарных дней.
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
