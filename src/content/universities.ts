/**
 * Supported universities.
 *
 * Authoritative registry for every public university detail route. Slugs are
 * stable public identifiers — never rename casually. Official URLs are stored
 * only when verified; omit when uncertain rather than guessing.
 *
 * @module content/universities
 */

import { BRAND, LINKS, SITE_URL } from "./site";

export type UniversityStatus = "online" | "soon";

export type University = {
  /** Stable public URL segment for `/unis/<slug>`. Must match `[a-z0-9-]+`. */
  slug: string;
  /** Short display code shown in the directory grid. */
  code: string;
  /** Full Russian display name. */
  name: string;
  /** City or multi-campus locality label. */
  city: string;
  /** Availability enum; labels come from {@link UNIVERSITY_STATUS_LABELS}. */
  status: UniversityStatus;
  /** Optional verified official homepage. Omitted when not verified. */
  officialUrl?: string;
};

export type UniversityFaq = {
  question: string;
  answer: string;
};

/** Central status → Russian UI label mapping (single source for all surfaces). */
export const UNIVERSITY_STATUS_LABELS = {
  online: "Онлайн",
  soon: "Скоро",
} as const satisfies Record<UniversityStatus, string>;

export const UNIVERSITIES: readonly University[] = [
  {
    slug: "reu-plekhanov",
    code: "РЭУ",
    name: "РЭУ им. Г. В. Плеханова",
    city: "Москва",
    status: "online",
    officialUrl: "https://www.rea.ru/",
  },
  {
    slug: "financial-university",
    code: "ФУ",
    name: "Финансовый университет при Правительстве РФ",
    city: "Москва",
    status: "online",
    officialUrl: "https://www.fa.ru/",
  },
  {
    slug: "spbu",
    code: "СПбГУ",
    name: "Санкт-Петербургский государственный университет",
    city: "Санкт-Петербург",
    status: "online",
    officialUrl: "https://spbu.ru/",
  },
  {
    slug: "sinergiya",
    code: "Синергия",
    name: "Университет «Синергия»",
    city: "Москва",
    status: "online",
    officialUrl: "https://synergy.ru/",
  },
  {
    slug: "spbstu",
    code: "СПбПУ",
    name: "Санкт-Петербургский политехнический университет Петра Великого",
    city: "Санкт-Петербург",
    status: "online",
    officialUrl: "https://www.spbstu.ru/",
  },
  {
    slug: "urfu",
    code: "УрФУ",
    name: "Уральский федеральный университет им. первого Президента России Б. Н. Ельцина",
    city: "Екатеринбург",
    status: "online",
    officialUrl: "https://urfu.ru/",
  },
  {
    slug: "rudn",
    code: "РУДН",
    name: "Российский университет дружбы народов",
    city: "Москва",
    status: "online",
    officialUrl: "https://www.rudn.ru/",
  },
  {
    slug: "mgimo",
    code: "МГИМО",
    name: "Московский государственный институт международных отношений",
    city: "Москва",
    status: "online",
    officialUrl: "https://mgimo.ru/",
  },
  {
    slug: "dgtu",
    code: "ДГТУ",
    name: "Донской государственный технический университет",
    city: "Ростов-на-Дону",
    status: "online",
    officialUrl: "https://donstu.ru/",
  },
  {
    slug: "kfu",
    code: "КФУ",
    name: "Казанский федеральный университет",
    city: "Казань",
    status: "online",
    officialUrl: "https://kpfu.ru/",
  },
  {
    slug: "mirea",
    code: "МИРЭА",
    name: "Российский технологический университет МИРЭА",
    city: "Москва",
    status: "online",
    officialUrl: "https://www.mirea.ru/",
  },
  {
    slug: "ranepa",
    code: "РАНХиГС",
    name: "Российская академия народного хозяйства и государственной службы",
    city: "Москва",
    status: "online",
    officialUrl: "https://www.ranepa.ru/",
  },
  {
    slug: "miit",
    code: "МИИТ",
    name: "Российский университет транспорта (МИИТ)",
    city: "Москва",
    status: "online",
    officialUrl: "https://www.rut-miit.ru/",
  },
  {
    slug: "hse",
    code: "ВШЭ",
    name: "Национальный исследовательский университет «Высшая школа экономики»",
    city: "Москва · СПб · Нижний · Пермь",
    status: "online",
    officialUrl: "https://www.hse.ru/",
  },
  {
    slug: "mephi",
    code: "МИФИ",
    name: "Национальный исследовательский ядерный университет «МИФИ»",
    city: "Москва",
    status: "online",
    officialUrl: "https://mephi.ru/",
  },
  {
    slug: "mipt",
    code: "МФТИ",
    name: "Московский физико-технический институт",
    city: "Долгопрудный",
    status: "online",
    officialUrl: "https://mipt.ru/",
  },
  {
    slug: "mpei",
    code: "МЭИ",
    name: "Национальный исследовательский университет «МЭИ»",
    city: "Москва",
    status: "online",
    officialUrl: "https://mpei.ru/",
  },
  {
    slug: "tgu-tolyatti",
    code: "ТГУ",
    name: "Тольяттинский государственный университет",
    city: "Тольятти",
    status: "online",
    officialUrl: "https://www.tltsu.ru/",
  },
  {
    slug: "unecon",
    code: "СПбГЭУ",
    name: "Санкт-Петербургский государственный экономический университет",
    city: "Санкт-Петербург",
    status: "online",
    officialUrl: "https://unecon.ru/",
  },
  {
    slug: "rggu",
    code: "РГГУ",
    name: "Российский государственный гуманитарный университет",
    city: "Москва",
    status: "online",
    officialUrl: "https://www.rsuh.ru/",
  },
  {
    slug: "msu",
    code: "МГУ",
    name: "Московский государственный университет им. М. В. Ломоносова",
    city: "Москва",
    status: "online",
    officialUrl: "https://www.msu.ru/",
  },
  {
    slug: "sfu",
    code: "СФУ",
    name: "Сибирский федеральный университет",
    city: "Красноярск",
    status: "online",
    officialUrl: "https://www.sfu-kras.ru/",
  },
  {
    slug: "nngu",
    code: "ННГУ",
    name: "Нижегородский государственный университет им. Н. И. Лобачевского",
    city: "Нижний Новгород",
    status: "online",
    // officialUrl omitted: public https endpoint redirects to insecure http://www.unn.ru/.
  },
  {
    slug: "bmstu",
    code: "МГТУ",
    name: "Московский государственный технический университет им. Н. Э. Баумана",
    city: "Москва",
    status: "online",
    // officialUrl omitted: bmstu.ru currently redirects to mirror.bmstu.ru; keep omitted until stable.
  },
  {
    slug: "susu",
    code: "ЮУрГУ",
    name: "Южно-Уральский государственный университет",
    city: "Челябинск",
    status: "online",
    // officialUrl omitted: root redirects to language-specific /en; Russian homepage not stable enough.
  },
] as const;

const BY_SLUG = new Map(UNIVERSITIES.map((university) => [university.slug, university]));

/** Lookup a registry record by public slug. Unknown or empty → `undefined`. */
export function findUniversity(slug: string): University | undefined {
  const key = typeof slug === "string" ? slug.trim() : "";
  if (!key || key.length > 200) return undefined;
  return BY_SLUG.get(key);
}

/** Public no-slash path for a university detail page. */
export function universityPagePath(slug: string): `/unis/${string}` {
  return `/unis/${slug}`;
}

/** Absolute canonical detail URL. */
export function universityPageUrl(slug: string): string {
  return `${SITE_URL}${universityPagePath(slug)}`;
}

/** University-specific Telegram conversion deep-link. */
export function universityBotUrl(slug: string): string {
  return `${LINKS.botUrl}?start=from-site_${slug}`;
}

/** Generic site conversion deep-link (homepage / non-entity CTAs). */
export function genericBotUrl(): string {
  return LINKS.genericBotUrl;
}

/** Exact display label for a registry status enum value. */
export function statusLabel(status: UniversityStatus): string {
  return UNIVERSITY_STATUS_LABELS[status];
}

/**
 * Minimum character length for the detail-content selector on a university
 * landing page. Validators use this as the published floor for non-placeholder
 * entity copy.
 */
export const DETAIL_CONTENT_MIN_LENGTH = 120;

/** Required affiliation-boundary wording on every university detail page. */
export const AFFILIATION_BOUNDARY = "Сервис не является официальным сервисом вуза" as const;

const DETAIL_FOCUS_BY_SLUG: Readonly<Record<string, string>> = {
  "reu-plekhanov": "На этой странице удобно проверить привязку РЭУ к утренней выдаче и сразу перейти к подключению.",
  "financial-university": "Карточка Финансового университета собрана для быстрого перехода от поиска вуза к настройке уведомлений.",
  spbu: "Для СПбГУ здесь отдельно вынесены город, статус поддержки и путь к Telegram-подключению.",
  sinergiya: "Страница Синергии помогает сверить запись реестра перед первым переходом в бот.",
  spbstu: "Для СПбПУ полезно начать с блока статуса, а затем открыть ссылку с привязкой к этому вузу.",
  urfu: "В карточке УрФУ собраны ориентиры для утреннего сценария без публикации таблиц занятий на сайте.",
  rudn: "Страница РУДН отделяет информацию о доставке от официальных вопросов университета.",
  mgimo: "Для МГИМО эта страница служит коротким маршрутом к Telegram и обратно в каталог поддерживаемых вузов.",
  dgtu: "Карточка ДГТУ показывает, какие данные относятся к реестру Vuzora, а какие нужно уточнять у вуза.",
  kfu: "Для КФУ в одном месте собраны город, состояние подключения и утренний формат сообщений.",
  mirea: "Страница МИРЭА объясняет сценарий доставки без обещаний о полноте официального расписания.",
  ranepa: "Для РАНХиГС добавлен отдельный ответ о привязке перехода, чтобы не перепутать его с общим CTA сайта.",
  miit: "Карточка МИИТ помогает найти нужный маршрут по коду и проверить его перед запуском Telegram-бота.",
  hse: "Для ВШЭ город отображается в реестровом виде, а подробности доставки остаются в честных пределах сервиса.",
  mephi: "Страница МИФИ делает акцент на утреннем уведомлении и не подменяет официальные источники университета.",
  mipt: "Для МФТИ здесь легко сверить код, статус и точную ссылку с параметром этого slug.",
  mpei: "Карточка МЭИ показывает путь от каталога к уведомлениям, сохраняя границу между Vuzora и вузом.",
  "tgu-tolyatti": "Для ТГУ в Тольятти блоки страницы помогают быстро отличить город реестра от настроек Telegram-доставки.",
  unecon: "Страница СПбГЭУ связывает карточку каталога с утренним сценарием и понятным возвратом к списку вузов.",
  rggu: "Для РГГУ здесь собраны ответы о подключении и статусе, без выдуманных деталей учебного процесса.",
  msu: "Карточка МГУ даёт отдельный маршрут к Telegram-подключению и сохраняет официальные вопросы за каналами университета.",
  sfu: "Для СФУ описание сфокусировано на доставке уведомлений, а не на копировании расписания в публичную страницу.",
  nngu: "Страница ННГУ помогает найти запись по коду и городу, затем перейти к утреннему формату Vuzora.",
  bmstu: "Для МГТУ им. Баумана FAQ уточняет границы сервиса и оставляет официальные изменения университету.",
  susu: "Карточка ЮУрГУ собрана как самостоятельная точка входа: статус, город, подключение и ответы находятся рядом.",
};

/** Entity-specific body copy for the detail page (server-visible). */
export function universityDetailCopy(university: University): string {
  const availability =
    university.status === "online"
      ? "Расписание уже доступно в Vuzora"
      : "Поддержка вуза готовится — можно оставить запрос";
  return (
    `${availability}: ${university.name} (${university.code}, ${university.city}). ` +
    `Vuzora присылает расписание пар в Telegram по утрам в выбранный слот с 05:00 до 10:00 МСК — ` +
    `без поиска по сайтам и без рекламного шума. ${AFFILIATION_BOUNDARY} ` +
    `${DETAIL_FOCUS_BY_SLUG[university.slug] ?? `Для ${university.code} здесь собраны статус, город и путь к подключению.`} ` +
    `Vuzora опирается на открытые источники расписания. Открой бота по кнопке ниже, чтобы подключить ` +
    `этот вуз: ссылка передаёт параметр start=from-site_${university.slug}.`
  );
}

/**
 * Entity-specific FAQ content for the detail page and its structured-data
 * extension. Every answer carries registry identity so pages remain useful
 * when read independently from the directory.
 */
export function universityFaq(university: University): readonly UniversityFaq[] {
  const availability = statusLabel(university.status).toLowerCase();
  return [
    {
      question: `Как подключить расписание ${university.code} в Telegram?`,
      answer: `Открой кнопку подключения на странице ${university.name}, перейди в Vuzora и выбери ${university.code}. Ссылка страницы передаёт start=from-site_${university.slug}, чтобы запрос не потерял привязку к вузу.`,
    },
    {
      question: `Когда приходит расписание ${university.name}?`,
      answer: `Для ${university.name} доставка настроена на утренний слот: сообщения с расписанием приходят в Telegram в выбранное время между 05:00 и 10:00 по Москве. Точное расписание занятий на странице не публикуется и не заменяет проверку в официальных каналах.`,
    },
    {
      question: `Какой статус у ${university.code} и для какого города он указан?`,
      answer: `${university.code} имеет статус «${statusLabel(university.status)}», а в реестре Vuzora указан город: ${university.city}. ${availability === "онлайн" ? "Подключение доступно сейчас." : "Поддержка готовится, поэтому подключение может быть недоступно."}`,
    },
    {
      question: `Является ли Vuzora официальным сервисом ${university.name}?`,
      answer: `${AFFILIATION_BOUNDARY}. Vuzora только помогает получать сообщения в Telegram. За подтверждением занятий, документов и любых официальных изменений обращайся к ${university.name}.`,
    },
  ];
}

/** All public detail paths derived from the registry (prerender / sitemap). */
export function universityDetailPaths(): readonly string[] {
  return UNIVERSITIES.map((university) => universityPagePath(university.slug));
}

const TITLE_MIN = 10;
const TITLE_MAX = 70;
const DESCRIPTION_MIN = 50;
const DESCRIPTION_MAX = 170;

function withinBounds(value: string, min: number, max: number): boolean {
  return value.length >= min && value.length <= max;
}

/**
 * Unique Russian detail title (10–70 chars). Prefers the full registry name;
 * when that overflows, uses code + city so the page stays identifiable.
 */
export function universityDetailTitle(university: University): string {
  const brand = ` – ${BRAND.name}`;
  const candidates = [
    `Расписание ${university.name}${brand}`,
    `${university.name}: расписание в Telegram`,
    `Расписание ${university.code} · ${university.city}${brand}`,
    `Расписание ${university.code} в Telegram${brand}`,
  ];
  for (const candidate of candidates) {
    if (withinBounds(candidate, TITLE_MIN, TITLE_MAX)) return candidate;
  }
  // Last resort for pathological registry data: keep brand + code, hard-bound.
  const fallback = `Расписание ${university.code}${brand}`;
  return withinBounds(fallback, TITLE_MIN, TITLE_MAX)
    ? fallback
    : fallback.slice(0, TITLE_MAX - 1).trimEnd() + "…";
}

/**
 * Unique Russian detail description (50–170 chars). Always includes the full
 * registry name, city, mapped status, Telegram schedule intent, and affiliation boundary.
 */
export function universityDetailDescription(university: University): string {
  const status = statusLabel(university.status);
  const primary =
    `Расписание пар ${university.name} (${university.city}) в Telegram. ` +
    `Vuzora присылает расписание по утрам. Статус: ${status}. ` +
    `${AFFILIATION_BOUNDARY}.`;
  if (withinBounds(primary, DESCRIPTION_MIN, DESCRIPTION_MAX)) return primary;

  const compact =
    `Расписание ${university.name}. ${university.city}. Статус ${status}. ` +
    `Получай расписание пар в Telegram через Vuzora. ${AFFILIATION_BOUNDARY}.`;
  if (withinBounds(compact, DESCRIPTION_MIN, DESCRIPTION_MAX)) return compact;

  // Preserve the full name; trim only the trailing guidance when needed.
  if (compact.length > DESCRIPTION_MAX) {
    return compact.slice(0, DESCRIPTION_MAX - 1).trimEnd() + "…";
  }
  // Pad short edge-cases (should not occur with the current registry).
  return `${compact} Расписание в Telegram.`;
}
