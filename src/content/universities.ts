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
  },
  {
    slug: "financial-university",
    code: "ФУ",
    name: "Финансовый университет при Правительстве РФ",
    city: "Москва",
    status: "online",
  },
  {
    slug: "spbu",
    code: "СПбГУ",
    name: "Санкт-Петербургский государственный университет",
    city: "Санкт-Петербург",
    status: "online",
  },
  {
    slug: "sinergiya",
    code: "Синергия",
    name: "Университет «Синергия»",
    city: "Москва",
    status: "online",
  },
  {
    slug: "spbstu",
    code: "СПбПУ",
    name: "Санкт-Петербургский политехнический университет Петра Великого",
    city: "Санкт-Петербург",
    status: "online",
  },
  {
    slug: "urfu",
    code: "УрФУ",
    name: "Уральский федеральный университет им. первого Президента России Б. Н. Ельцина",
    city: "Екатеринбург",
    status: "online",
  },
  {
    slug: "rudn",
    code: "РУДН",
    name: "Российский университет дружбы народов",
    city: "Москва",
    status: "online",
  },
  {
    slug: "mgimo",
    code: "МГИМО",
    name: "Московский государственный институт международных отношений",
    city: "Москва",
    status: "online",
  },
  {
    slug: "dgtu",
    code: "ДГТУ",
    name: "Донской государственный технический университет",
    city: "Ростов-на-Дону",
    status: "online",
  },
  {
    slug: "kfu",
    code: "КФУ",
    name: "Казанский федеральный университет",
    city: "Казань",
    status: "online",
  },
  {
    slug: "mirea",
    code: "МИРЭА",
    name: "Российский технологический университет МИРЭА",
    city: "Москва",
    status: "online",
  },
  {
    slug: "ranepa",
    code: "РАНХиГС",
    name: "Российская академия народного хозяйства и государственной службы",
    city: "Москва",
    status: "online",
  },
  {
    slug: "miit",
    code: "МИИТ",
    name: "Российский университет транспорта (МИИТ)",
    city: "Москва",
    status: "online",
  },
  {
    slug: "hse",
    code: "ВШЭ",
    name: "Национальный исследовательский университет «Высшая школа экономики»",
    city: "Москва · СПб · Нижний · Пермь",
    status: "online",
  },
  {
    slug: "mephi",
    code: "МИФИ",
    name: "Национальный исследовательский ядерный университет «МИФИ»",
    city: "Москва",
    status: "online",
  },
  {
    slug: "mipt",
    code: "МФТИ",
    name: "Московский физико-технический институт",
    city: "Долгопрудный",
    status: "online",
  },
  {
    slug: "mpei",
    code: "МЭИ",
    name: "Национальный исследовательский университет «МЭИ»",
    city: "Москва",
    status: "online",
  },
  {
    slug: "tgu-tolyatti",
    code: "ТГУ",
    name: "Тольяттинский государственный университет",
    city: "Тольятти",
    status: "online",
  },
  {
    slug: "unecon",
    code: "СПбГЭУ",
    name: "Санкт-Петербургский государственный экономический университет",
    city: "Санкт-Петербург",
    status: "online",
  },
  {
    slug: "rggu",
    code: "РГГУ",
    name: "Российский государственный гуманитарный университет",
    city: "Москва",
    status: "online",
  },
  {
    slug: "msu",
    code: "МГУ",
    name: "Московский государственный университет им. М. В. Ломоносова",
    city: "Москва",
    status: "online",
  },
  {
    slug: "sfu",
    code: "СФУ",
    name: "Сибирский федеральный университет",
    city: "Красноярск",
    status: "online",
  },
  {
    slug: "nngu",
    code: "ННГУ",
    name: "Нижегородский государственный университет им. Н. И. Лобачевского",
    city: "Нижний Новгород",
    status: "online",
  },
  {
    slug: "bmstu",
    code: "МГТУ",
    name: "Московский государственный технический университет им. Н. Э. Баумана",
    city: "Москва",
    status: "online",
  },
  {
    slug: "susu",
    code: "ЮУрГУ",
    name: "Южно-Уральский государственный университет",
    city: "Челябинск",
    status: "online",
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
export const AFFILIATION_BOUNDARY =
  "Сервис не является официальным сервисом вуза" as const;

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
    `и опирается на открытые источники расписания. Открой бота по кнопке ниже, чтобы подключить ` +
    `этот вуз: ссылка передаёт параметр start=from-site_${university.slug}.`
  );
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
