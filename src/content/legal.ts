/**
 * Legal documents as data.
 *
 * The offer and the privacy policy used to live as prose inside their route
 * JSX. They are now structured content so the rendered page and the Markdown
 * mirror at `/legal/terms.md` and `/legal/privacy.md` are two renderings of
 * one source — an agent quoting the refund window must not be able to read a
 * different number than a person does.
 *
 * Paragraph text uses the shared `[[href|label]]` markup from
 * `src/lib/rich-text.tsx`. Keep the prose here and the layout in the route.
 *
 * @module content/legal
 */

import { BRAND, LINKS } from "./site";
import { PLANS, formatPrice } from "./pricing";

/** One rendered block inside a section: a paragraph or a bulleted list. */
export type LegalBlock = { kind: "p"; text: string } | { kind: "ul"; items: readonly string[] };

export type LegalSection = {
  /** Numbered H2, e.g. «1. Стороны». */
  title: string;
  blocks: readonly LegalBlock[];
};

export type LegalDocument = {
  /** Canonical page path, with the trailing slash every public page carries. */
  path: string;
  /** H1 and Markdown identity heading. */
  heading: string;
  /** `<title>` and mirror title line. */
  title: string;
  /** Meta description, reused verbatim by the mirror. */
  description: string;
  /** Revision date shown under the H1. */
  revision: string;
  sections: readonly LegalSection[];
};

const entityLine = `${BRAND.legal.entity}, ИНН ${BRAND.legal.inn}, ${BRAND.legal.city}`;
const emailLink = `[[mailto:${BRAND.email}|${BRAND.email}]]`;
const supportLink = `[[${LINKS.supportBotUrl}|${LINKS.supportHandle}]]`;
const botLink = `[[${LINKS.botUrl}|${LINKS.botHandle}]]`;

export const TERMS: LegalDocument = {
  path: "/legal/terms/",
  heading: "Публичная оферта",
  title: "Публичная оферта – Vuzora",
  description:
    "Условия оказания услуг сервиса Vuzora: подписка, оплата, возврат средств и ответственность сторон.",
  revision: BRAND.legal.revision,
  sections: [
    {
      title: "1. Стороны",
      blocks: [
        {
          kind: "p",
          text:
            `${entityLine} – далее «Исполнитель». Любое физическое лицо, активировавшее ` +
            `подписку в Telegram-боте ${botLink} – далее «Пользователь».`,
        },
      ],
    },
    {
      title: "2. Предмет",
      blocks: [
        {
          kind: "p",
          text:
            "Исполнитель предоставляет доступ к Telegram-боту Vuzora, который ежедневно " +
            "публикует расписание занятий пользователя на основе открытых данных вузов. " +
            BRAND.legal.disclaimer,
        },
      ],
    },
    {
      title: "3. Подписка и оплата",
      blocks: [
        {
          kind: "p",
          text:
            "Стоимость и срок действия тарифов указаны на странице [[/pricing/|«Тарифы»]] и " +
            "являются неотъемлемой частью оферты. Действующие тарифы на момент редакции:",
        },
        {
          kind: "ul",
          items: PLANS.map((plan) => `${plan.period} – ${formatPrice(plan.price)} ₽`),
        },
        {
          kind: "p",
          text:
            "Оплата подписки – единовременным платежом, без автоматического продления. " +
            "Услуга считается оказанной с момента активации доступа в боте.",
        },
      ],
    },
    {
      title: "4. Возврат средств",
      blocks: [
        {
          kind: "p",
          text:
            "Возврат полной стоимости подписки возможен в течение 14 календарных дней с момента " +
            "оплаты, если Пользователь не получил ни одной доставки расписания. По истечении " +
            "14 дней, а также если доставки выполнялись, возврат осуществляется пропорционально " +
            "неиспользованному сроку подписки.",
        },
        {
          kind: "p",
          text:
            `Заявка на возврат направляется на ${emailLink} с указанием Telegram-аккаунта и ` +
            "даты оплаты. Срок рассмотрения – до 10 рабочих дней.",
        },
      ],
    },
    {
      title: "5. Ответственность",
      blocks: [
        {
          kind: "p",
          text:
            "Исполнитель не несёт ответственности за изменения расписания на стороне вуза, " +
            "временную недоступность официальных систем вузов и за решения, принятые " +
            "Пользователем на основе полученной информации.",
        },
      ],
    },
    {
      title: "6. Контакты",
      blocks: [
        {
          kind: "ul",
          items: [
            `${BRAND.legal.entity} · ИНН ${BRAND.legal.inn} · ${BRAND.legal.city}`,
            `Электронная почта: ${emailLink}`,
            `Поддержка в Telegram: ${supportLink}`,
          ],
        },
      ],
    },
  ],
};

export const PRIVACY: LegalDocument = {
  path: "/legal/privacy/",
  heading: "Политика конфиденциальности",
  title: "Политика конфиденциальности – Vuzora",
  description:
    "Какие персональные данные собирает Vuzora, как они хранятся и как пользователь может их удалить.",
  revision: BRAND.legal.revision,
  sections: [
    {
      title: "1. Оператор данных",
      blocks: [
        {
          kind: "p",
          text: `${entityLine}. Связь по вопросам персональных данных: ${emailLink}.`,
        },
      ],
    },
    {
      title: "2. Какие данные мы обрабатываем",
      blocks: [
        {
          kind: "ul",
          items: [
            "Telegram-идентификатор и имя аккаунта (передаются Telegram API при первом запуске бота).",
            "Выбранный вуз, факультет, группа – чтобы знать, какое расписание отправлять.",
            "Часовой пояс и язык интерфейса – чтобы доставка приходила вовремя.",
            "Технические логи доставки сообщений – для отладки и сохранения качества сервиса.",
          ],
        },
        {
          kind: "p",
          text:
            "Мы не собираем e-mail, номер телефона, фамилию, паспортные данные, геолокацию и " +
            "платёжные реквизиты. Оплата подписки проходит через внешнего платёжного " +
            "провайдера – см. его политику.",
        },
      ],
    },
    {
      title: "3. Цели обработки",
      blocks: [
        {
          kind: "ul",
          items: [
            "Ежедневная доставка расписания в Telegram.",
            `Поддержка пользователя в боте ${supportLink}.`,
            "Учёт активных подписок и сроков их действия.",
          ],
        },
      ],
    },
    {
      title: "4. Сроки и хранение",
      blocks: [
        {
          kind: "p",
          text:
            "Данные хранятся, пока активна подписка либо до момента, когда пользователь явно " +
            "удалит аккаунт командой /delete в боте. После удаления данные стираются в течение " +
            "30 календарных дней, кроме обезличенных агрегированных логов.",
        },
      ],
    },
    {
      title: "5. Третьи стороны",
      blocks: [
        {
          kind: "ul",
          items: [
            "Telegram – доставка сообщений (Telegram Privacy Policy).",
            "Хостинг-провайдер – размещение сервера бота.",
            "Платёжный провайдер – обработка оплаты подписки.",
          ],
        },
        {
          kind: "p",
          text:
            "Vuzora не передаёт данные рекламным сетям и не использует на сайте cookie, " +
            "веб-аналитику и сторонние трекеры.",
        },
      ],
    },
    {
      title: "6. Права пользователя",
      blocks: [
        {
          kind: "p",
          text:
            "Пользователь вправе получить копию своих данных, исправить их или удалить, " +
            `отправив запрос на ${emailLink}. Срок ответа – до 30 календарных дней.`,
        },
      ],
    },
  ],
};

/** Both legal documents, in the order they appear in the footer. */
export const LEGAL_DOCUMENTS: readonly LegalDocument[] = [TERMS, PRIVACY] as const;
