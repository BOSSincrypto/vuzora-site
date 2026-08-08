/**
 * Supported universities.
 *
 * Authoritative registry for every public university detail route. Slugs are
 * stable public identifiers — never rename casually. Official URLs are stored
 * only when verified; omit when uncertain rather than guessing.
 *
 * @module content/universities
 */

import { LINKS, SITE_URL } from "./site";

export type UniversityStatus = "online" | "soon";

export type University = {
  /** Stable public URL segment for `/unis/<slug>/`. Must match `[a-z0-9-]+`. */
  slug: string;
  /** Short display code shown in the directory grid. */
  code: string;
  /** Full Russian display name. */
  name: string;
  /** City or multi-campus locality label. */
  city: string;
  /** Availability enum; labels come from {@link UNIVERSITY_STATUS_LABELS}. */
  status: UniversityStatus;
  /**
   * Optional recognizable short name, e.g. «МГТУ им. Н. Э. Баумана».
   *
   * Some official names are too long to fit a title alongside «Расписание»,
   * and the bare code is often ambiguous — «МГТУ» is Bauman, but also ГА and
   * Станкин. This is the form people actually use, and it sits between the
   * full declined name and the code in the title candidate order. Keep it
   * built on an indeclinable abbreviation so it reads correctly straight after
   * «Расписание». Set it only when it says more than `code` already does.
   */
  shortName?: string;
  /** Optional verified official homepage. Omitted when not verified. */
  officialUrl?: string;
  /**
   * Optional official schedule page — the university's own timetable, not this
   * site's. Vuzora publishes no class tables, so the honest answer to "где
   * расписание" is a link to the source. Same rule as `officialUrl`: confirmed
   * before it lands here, omitted when uncertain. Some universities put the
   * timetable inside a student portal and some publish it per faculty with no
   * central page — the entry is the university's real entry point, whatever
   * shape that takes, and stays empty when there is no single one.
   */
  scheduleUrl?: string;
};

export type UniversityFaq = {
  question: string;
  answer: string;
};

type UniversityFaqCluster = "capital" | "regional" | "multi-campus";

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
    scheduleUrl: "https://rasp.rea.ru/",
  },
  {
    slug: "financial-university",
    code: "ФУ",
    name: "Финансовый университет при Правительстве РФ",
    city: "Москва",
    status: "online",
    officialUrl: "https://www.fa.ru/",
    scheduleUrl: "https://ruz.fa.ru/",
  },
  {
    slug: "spbu",
    code: "СПбГУ",
    name: "Санкт-Петербургский государственный университет",
    city: "Санкт-Петербург",
    status: "online",
    officialUrl: "https://spbu.ru/",
    scheduleUrl: "https://timetable.spbu.ru/",
  },
  {
    slug: "sinergiya",
    code: "Синергия",
    name: "Университет «Синергия»",
    city: "Москва",
    status: "online",
    officialUrl: "https://synergy.ru/",
    scheduleUrl: "https://synergyuniversity.ru/students/schedule",
  },
  {
    slug: "spbstu",
    code: "СПбПУ",
    shortName: "СПбПУ Петра Великого",
    name: "Санкт-Петербургский политехнический университет Петра Великого",
    city: "Санкт-Петербург",
    status: "online",
    officialUrl: "https://www.spbstu.ru/",
    scheduleUrl: "https://ruz.spbstu.ru/",
  },
  {
    slug: "urfu",
    code: "УрФУ",
    // Keep the registry name ≤70 chars so detail <title> can include the full name.
    name: "Уральский федеральный университет им. Б. Н. Ельцина",
    city: "Екатеринбург",
    status: "online",
    officialUrl: "https://urfu.ru/",
    scheduleUrl: "https://urfu.ru/ru/students/study/schedule/",
  },
  {
    slug: "rudn",
    code: "РУДН",
    name: "Российский университет дружбы народов",
    city: "Москва",
    status: "online",
    officialUrl: "https://www.rudn.ru/",
    scheduleUrl: "https://www.rudn.ru/education/schedule",
  },
  {
    slug: "mgimo",
    code: "МГИМО",
    name: "Московский государственный институт международных отношений",
    city: "Москва",
    status: "online",
    officialUrl: "https://mgimo.ru/",
    scheduleUrl: "https://ruz.mgimo.ru/ruz/",
  },
  {
    slug: "dgtu",
    code: "ДГТУ",
    name: "Донской государственный технический университет",
    city: "Ростов-на-Дону",
    status: "online",
    officialUrl: "https://donstu.ru/",
    scheduleUrl: "https://edu.donstu.ru/Default.aspx",
  },
  {
    slug: "kfu",
    code: "КФУ",
    name: "Казанский федеральный университет",
    city: "Казань",
    status: "online",
    officialUrl: "https://kpfu.ru/",
    scheduleUrl: "https://kpfu.ru/studentu/ucheba/raspisanie",
  },
  {
    slug: "mirea",
    code: "МИРЭА",
    name: "Российский технологический университет МИРЭА",
    city: "Москва",
    status: "online",
    officialUrl: "https://www.mirea.ru/",
    scheduleUrl: "https://www.mirea.ru/schedule/",
  },
  {
    slug: "ranepa",
    code: "РАНХиГС",
    name: "Российская академия народного хозяйства и государственной службы",
    city: "Москва",
    status: "online",
    officialUrl: "https://www.ranepa.ru/",
    scheduleUrl: "https://my.ranepa.ru/schedule/",
  },
  {
    slug: "miit",
    code: "МИИТ",
    name: "Российский университет транспорта (МИИТ)",
    city: "Москва",
    status: "online",
    officialUrl: "https://www.rut-miit.ru/",
    scheduleUrl: "https://www.miit.ru/timetable",
  },
  {
    slug: "hse",
    code: "ВШЭ",
    shortName: "НИУ ВШЭ",
    name: "Национальный исследовательский университет «Высшая школа экономики»",
    city: "Москва · СПб · Нижний · Пермь",
    status: "online",
    officialUrl: "https://www.hse.ru/",
    scheduleUrl: "https://ruz.hse.ru/",
  },
  {
    slug: "mephi",
    code: "МИФИ",
    shortName: "НИЯУ МИФИ",
    name: "Национальный исследовательский ядерный университет «МИФИ»",
    city: "Москва",
    status: "online",
    officialUrl: "https://mephi.ru/",
    scheduleUrl: "https://mephi.ru/students/schedule",
  },
  {
    slug: "mipt",
    code: "МФТИ",
    name: "Московский физико-технический институт",
    city: "Долгопрудный",
    status: "online",
    officialUrl: "https://mipt.ru/",
    scheduleUrl: "https://edu-mipt.ru/raspisanie",
  },
  {
    slug: "mpei",
    code: "МЭИ",
    name: "Национальный исследовательский университет «МЭИ»",
    city: "Москва",
    status: "online",
    officialUrl: "https://mpei.ru/",
    scheduleUrl: "https://mpei.ru/education/timetable/Pages/default.aspx",
  },
  {
    slug: "tgu-tolyatti",
    code: "ТГУ",
    name: "Тольяттинский государственный университет",
    city: "Тольятти",
    status: "online",
    officialUrl: "https://www.tltsu.ru/",
    scheduleUrl: "https://rasp.tltsu.ru/",
  },
  {
    slug: "unecon",
    code: "СПбГЭУ",
    name: "Санкт-Петербургский государственный экономический университет",
    city: "Санкт-Петербург",
    status: "online",
    officialUrl: "https://unecon.ru/",
    scheduleUrl: "https://rasp.unecon.ru/",
  },
  {
    slug: "rggu",
    code: "РГГУ",
    name: "Российский государственный гуманитарный университет",
    city: "Москва",
    status: "online",
    officialUrl: "https://www.rsuh.ru/",
    scheduleUrl: "https://raspis.rggu.ru/",
  },
  {
    slug: "msu",
    code: "МГУ",
    shortName: "МГУ им. М. В. Ломоносова",
    name: "Московский государственный университет им. М. В. Ломоносова",
    city: "Москва",
    status: "online",
    officialUrl: "https://www.msu.ru/",
    // scheduleUrl omitted: each faculty publishes its own schedule; no central page.
  },
  {
    slug: "sfu",
    code: "СФУ",
    name: "Сибирский федеральный университет",
    city: "Красноярск",
    status: "online",
    officialUrl: "https://www.sfu-kras.ru/",
    scheduleUrl: "https://edu.sfu-kras.ru/timetable",
  },
  {
    slug: "nngu",
    code: "ННГУ",
    shortName: "ННГУ им. Лобачевского",
    name: "Нижегородский государственный университет им. Н. И. Лобачевского",
    city: "Нижний Новгород",
    status: "online",
    // officialUrl omitted: public https endpoint redirects to insecure http://www.unn.ru/.
    scheduleUrl: "https://rasp.unn.ru/",
  },
  {
    slug: "bmstu",
    code: "МГТУ",
    shortName: "МГТУ им. Н. Э. Баумана",
    name: "Московский государственный технический университет им. Н. Э. Баумана",
    city: "Москва",
    status: "online",
    // officialUrl omitted: bmstu.ru currently redirects to mirror.bmstu.ru; keep omitted until stable.
    scheduleUrl: "https://lks.bmstu.ru/schedule/list",
  },
  {
    slug: "susu",
    code: "ЮУрГУ",
    name: "Южно-Уральский государственный университет",
    city: "Челябинск",
    status: "online",
    // officialUrl omitted: root redirects to language-specific /en; Russian homepage not stable enough.
    scheduleUrl: "https://www.susu.ru/ru/lessons/",
  },
] as const;

const BY_SLUG = new Map(UNIVERSITIES.map((university) => [university.slug, university]));

/** Lookup a registry record by public slug. Unknown or empty → `undefined`. */
export function findUniversity(slug: string): University | undefined {
  const key = typeof slug === "string" ? slug.trim() : "";
  if (!key || key.length > 200) return undefined;
  return BY_SLUG.get(key);
}

/**
 * Natural genitive forms for copy that follows «расписание» or a genitive
 * preposition. The registry `name` remains the exact display identity; these
 * inflections are only for surrounding Russian prose.
 */
const UNIVERSITY_GENITIVE_NAMES: Readonly<Record<string, string>> = {
  "reu-plekhanov": "РЭУ им. Г. В. Плеханова",
  "financial-university": "Финансового университета при Правительстве РФ",
  spbu: "Санкт-Петербургского государственного университета",
  sinergiya: "Университета «Синергия»",
  spbstu: "Санкт-Петербургского политехнического университета Петра Великого",
  urfu: "Уральского федерального университета им. Б. Н. Ельцина",
  rudn: "Российского университета дружбы народов",
  mgimo: "Московского государственного института международных отношений",
  dgtu: "Донского государственного технического университета",
  kfu: "Казанского федерального университета",
  mirea: "Российского технологического университета МИРЭА",
  ranepa: "Российской академии народного хозяйства и государственной службы",
  miit: "Российского университета транспорта (МИИТ)",
  hse: "Национального исследовательского университета «Высшая школа экономики»",
  mephi: "Национального исследовательского ядерного университета «МИФИ»",
  mipt: "Московского физико-технического института",
  mpei: "Национального исследовательского университета «МЭИ»",
  "tgu-tolyatti": "Тольяттинского государственного университета",
  unecon: "Санкт-Петербургского государственного экономического университета",
  rggu: "Российского государственного гуманитарного университета",
  msu: "Московского государственного университета им. М. В. Ломоносова",
  sfu: "Сибирского федерального университета",
  nngu: "Нижегородского государственного университета им. Н. И. Лобачевского",
  bmstu: "Московского государственного технического университета им. Н. Э. Баумана",
  susu: "Южно-Уральского государственного университета",
};

/** Return the registry university name in natural genitive Russian copy. */
export function universityGenitiveName(university: University): string {
  return UNIVERSITY_GENITIVE_NAMES[university.slug] ?? university.name;
}

/**
 * Public path for a university detail page.
 *
 * Trailing slash is canonical: GitHub Pages serves the page from
 * `unis/<slug>/index.html`, so the slashless form only 301-redirects here.
 */
export function universityPagePath(slug: string): `/unis/${string}/` {
  return `/unis/${slug}/`;
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
  "reu-plekhanov":
    "На этой странице удобно проверить привязку РЭУ к утренней выдаче и сразу перейти к подключению.",
  "financial-university":
    "Карточка Финансового университета собрана для быстрого перехода от поиска вуза к настройке уведомлений.",
  spbu: "Для СПбГУ здесь отдельно вынесены город, статус поддержки и путь к Telegram-подключению.",
  sinergiya: "Страница Синергии помогает сверить запись реестра перед первым переходом в бот.",
  spbstu:
    "Для СПбПУ полезно начать с блока статуса, а затем открыть ссылку с привязкой к этому вузу.",
  urfu: "В карточке УрФУ собраны ориентиры для утреннего сценария без публикации таблиц занятий на сайте.",
  rudn: "Страница РУДН отделяет информацию о доставке от официальных вопросов университета.",
  mgimo:
    "Для МГИМО эта страница служит коротким маршрутом к Telegram и обратно в каталог поддерживаемых вузов.",
  dgtu: "Карточка ДГТУ показывает, какие данные относятся к реестру Vuzora, а какие нужно уточнять у вуза.",
  kfu: "Для КФУ в одном месте собраны город, состояние подключения и утренний формат сообщений.",
  mirea:
    "Страница МИРЭА объясняет сценарий доставки без обещаний о полноте официального расписания.",
  ranepa:
    "Для РАНХиГС добавлен отдельный ответ о привязке перехода, чтобы не перепутать его с общим CTA сайта.",
  miit: "Карточка МИИТ помогает найти нужный маршрут по коду и проверить его перед запуском Telegram-бота.",
  hse: "Для ВШЭ город отображается в реестровом виде, а подробности доставки остаются в честных пределах сервиса.",
  mephi:
    "Страница МИФИ делает акцент на утреннем уведомлении и не подменяет официальные источники университета.",
  mipt: "Для МФТИ здесь легко сверить код, статус и точную ссылку с параметром этого slug.",
  mpei: "Карточка МЭИ показывает путь от каталога к уведомлениям, сохраняя границу между Vuzora и вузом.",
  "tgu-tolyatti":
    "Для ТГУ в Тольятти блоки страницы помогают быстро отличить город реестра от настроек Telegram-доставки.",
  unecon:
    "Страница СПбГЭУ связывает карточку каталога с утренним сценарием и понятным возвратом к списку вузов.",
  rggu: "Для РГГУ здесь собраны ответы о подключении и статусе, без выдуманных деталей учебного процесса.",
  msu: "Карточка МГУ даёт отдельный маршрут к Telegram-подключению и сохраняет официальные вопросы за каналами университета.",
  sfu: "Для СФУ описание сфокусировано на доставке уведомлений, а не на копировании расписания в публичную страницу.",
  nngu: "Страница ННГУ помогает найти запись по коду и городу, затем перейти к утреннему формату Vuzora.",
  bmstu:
    "Для МГТУ им. Баумана FAQ уточняет границы сервиса и оставляет официальные изменения университету.",
  susu: "Карточка ЮУрГУ собрана как самостоятельная точка входа: статус, город, подключение и ответы находятся рядом.",
};

/**
 * Host of the verified official schedule page (`timetable.spbu.ru`), or `null`
 * when the registry has no verified address for this university.
 */
export function scheduleSourceHost(university: University): string | null {
  if (!university.scheduleUrl) return null;
  try {
    return new URL(university.scheduleUrl).host.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * Names the university's own timetable source when the registry has a verified
 * address. Vuzora publishes no class tables, so pointing at the official source
 * is the honest answer — and it is the one fact that genuinely differs between
 * detail pages.
 */
function officialScheduleSentence(university: University): string {
  const host = scheduleSourceHost(university);
  if (!host) return "";
  return (
    `Официальное расписание занятий ${universityGenitiveName(university)} публикуется на ${host} — ` +
    `Vuzora не дублирует и не заменяет этот источник. `
  );
}

/**
 * One self-contained sentence answering «расписание <вуз> в телеграм».
 *
 * The H2 above it carries the keyword but is not a claim; the detail copy
 * below states everything but takes a paragraph to do it. An answer engine
 * cites a sentence, so this is the sentence: who delivers what, when, and the
 * affiliation boundary — quotable without the rest of the page. Carries no
 * link, because the detail route may render each verified external URL exactly
 * once and that budget belongs to the official-source block.
 */
export function universityLeadSentence(university: University): string {
  return (
    `Vuzora присылает расписание ${universityGenitiveName(university)} в Telegram каждое утро ` +
    `в выбранный слот с 05:00 до 10:00 МСК. ${AFFILIATION_BOUNDARY}.`
  );
}

/** Entity-specific body copy for the detail page (server-visible). */
export function universityDetailCopy(university: University): string {
  const availability =
    university.status === "online"
      ? "Расписание уже доступно в Vuzora"
      : "Поддержка вуза готовится — можно оставить запрос";
  return (
    `${availability}: ${university.name} (${university.code}, ${university.city}). ` +
    `Vuzora присылает расписание пар в Telegram по утрам в выбранный слот с 05:00 до 10:00 МСК — ` +
    `без поиска по сайтам и без рекламного шума. ${AFFILIATION_BOUNDARY}. ` +
    officialScheduleSentence(university) +
    `${DETAIL_FOCUS_BY_SLUG[university.slug] ?? `Для ${university.code} здесь собраны статус, город и путь к подключению.`} ` +
    `Vuzora опирается на открытые источники расписания. Открой бота по кнопке ниже, чтобы подключить ` +
    `этот вуз: ссылка передаёт параметр start=from-site_${university.slug}.`
  );
}

function universityFaqCluster(university: University): UniversityFaqCluster {
  if (university.city.includes("·")) return "multi-campus";
  if (university.city === "Москва") return "capital";
  return "regional";
}

/**
 * Entity-specific FAQ content for the detail page and its structured-data
 * extension. Every answer carries registry identity so pages remain useful
 * when read independently from the directory.
 */
export function universityFaq(university: University): readonly UniversityFaq[] {
  const availability = statusLabel(university.status).toLowerCase();
  const genitiveName = universityGenitiveName(university);
  const cluster = universityFaqCluster(university);
  const framing =
    cluster === "multi-campus"
      ? {
          question: `Как учитывать несколько городов в карточке ${university.code}?`,
          answer: `В реестре Vuzora для ${university.code} указаны площадки: ${university.city}. Это городская привязка карточки, а не готовая таблица занятий: за деталями конкретной группы следи в официальных каналах ${genitiveName}.`,
        }
      : cluster === "capital"
        ? {
            question: `Когда приходит расписание ${genitiveName}?`,
            answer: `Для ${genitiveName} доставка настроена на утренний слот: сообщения с расписанием приходят в Telegram в выбранное время между 05:00 и 10:00 по Москве. Точное расписание занятий на странице не публикуется и не заменяет проверку в официальных каналах.`,
          }
        : {
            question: `Что проверить перед подключением ${university.code} в своём городе?`,
            answer: `Перед подключением ${university.code} сверяй город ${university.city} и название ${genitiveName} в карточке Vuzora. Сервис доставляет сообщения в Telegram, а детали занятий и официальные изменения нужно проверять в каналах университета.`,
          };
  return [
    {
      question: `Как подключить расписание ${university.code} в Telegram?`,
      answer: `Открой кнопку подключения на странице ${genitiveName}, перейди в Vuzora и выбери ${university.code}. Ссылка страницы передаёт start=from-site_${university.slug}, чтобы запрос не потерял привязку к вузу.`,
    },
    framing,
    {
      question: `Какой статус у ${university.code} и для какого города он указан?`,
      answer: `${university.code} имеет статус «${statusLabel(university.status)}», а в реестре Vuzora указан город: ${university.city}. ${availability === "онлайн" ? "Подключение доступно сейчас." : "Поддержка готовится, поэтому подключение может быть недоступно."}`,
    },
    {
      // Genitive after «сервисом» and after «каналы»: the registry name is
      // nominative and reads as a grammatical error inside a sentence, which
      // is also how it lands in the FAQPage structured data and the mirror.
      question: `Является ли Vuzora официальным сервисом ${genitiveName}?`,
      answer: `${AFFILIATION_BOUNDARY}. Vuzora только помогает получать сообщения в Telegram. За подтверждением занятий, документов и любых официальных изменений обращайся в официальные каналы ${genitiveName}.`,
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
 * Cyrillic «Телеграм», and only in detail titles. Everywhere else — body copy,
 * descriptions, JSON-LD, the UI — the site writes «Telegram» in Latin, and that
 * stays. The split is deliberate: the title is what a person reads in a search
 * result before deciding to click, and «в Телеграм» is the form Russian users
 * both type and recognize there. Do not "fix" this to match the rest of the
 * site. The parity that does matter — og:title and twitter:title — copies the
 * document title verbatim, so it follows along on its own.
 */
const TITLE_MESSENGER = "Телеграм";

/**
 * Unique Russian detail title (10–70 chars), always shaped
 * «Расписание <вуз> в Телеграм» — one form on every university page, so the
 * result says what the page is and where the schedule arrives before the click.
 *
 * Only the university part steps down, and only when the full name cannot fit
 * the 70-char budget: full declined name, then the recognizable short name,
 * then the registry code. Widening the budget instead is not an option —
 * search results truncate around 60–65 characters, so a longer title would push
 * «в Телеграм» out of view on exactly the universities with the longest names.
 * The full name still leads the H1 and the description on the page itself.
 *
 * The step-down never happens silently: the unit gate re-derives this ladder
 * and fails if a fitting form was skipped.
 */
export function universityDetailTitle(university: University): string {
  // «Расписание <Именительный падеж>» is ungrammatical in Russian; the query
  // form people type is declined too. Both engines handle morphology, so the
  // grammatical form costs nothing in matching and reads as written by a human.
  const genitive = universityGenitiveName(university);
  const candidates = [
    `Расписание ${genitive} в ${TITLE_MESSENGER}`,
    // The bare code is often ambiguous — «МГТУ» is Bauman, ГА and Станкин
    // alike — so a registry short name wins whenever one exists.
    ...(university.shortName ? [`Расписание ${university.shortName} в ${TITLE_MESSENGER}`] : []),
    `Расписание ${university.code} в ${TITLE_MESSENGER}`,
  ];
  for (const candidate of candidates) {
    if (withinBounds(candidate, TITLE_MIN, TITLE_MAX)) return candidate;
  }
  // Pathological registry code longer than TITLE_MAX: keep the shape rather
  // than the budget (bounds are enforced by release/unit gates, so the registry
  // stays honest).
  return candidates[candidates.length - 1];
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

  // Long names cannot be shortened without breaking the identity or the
  // affiliation boundary. Drop optional context in stages instead of slicing
  // the string, so the disclaimer is always complete and word-aligned.
  const boundedCandidates = [
    `Расписание ${university.name}. ${university.city}. Статус: ${status}. ${AFFILIATION_BOUNDARY}.`,
    `Расписание ${university.name}. ${university.city}. ${AFFILIATION_BOUNDARY}.`,
    `Расписание ${university.name}. Статус: ${status}. ${AFFILIATION_BOUNDARY}.`,
    `Расписание ${university.name}. ${AFFILIATION_BOUNDARY}.`,
  ];
  return (
    boundedCandidates.find((candidate) =>
      withinBounds(candidate, DESCRIPTION_MIN, DESCRIPTION_MAX),
    ) ?? boundedCandidates[boundedCandidates.length - 1]
  );
}
