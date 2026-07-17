import { readFile } from "node:fs/promises";
import { join } from "node:path";

const read = (path, root = process.cwd()) => readFile(join(root, path), "utf8");
const field = (record, name) => {
  const match = record.match(new RegExp(`\\b${name}\\s*:\\s*["']([^"']*)["']`));
  return match?.[1];
};

/** Extract the required affiliation-boundary wording from universities helpers. */
export function readAffiliationBoundary(universitiesSource) {
  const match = universitiesSource.match(
    /export const AFFILIATION_BOUNDARY\s*=\s*\n?\s*["']([^"']+)["']/,
  );
  if (!match?.[1]) throw new Error("Could not locate AFFILIATION_BOUNDARY export");
  return match[1];
}

export async function readRegistry(root = process.cwd()) {
  const [universitiesSource, blogSource] = await Promise.all([
    read("src/content/universities.ts", root),
    read("src/content/blog.ts", root),
  ]);
  const registryBlock = universitiesSource.match(
    /export const UNIVERSITIES[\s\S]*?=\s*\[[\s\S]*?\]\s*as const/,
  )?.[0];
  if (!registryBlock) throw new Error("Could not locate UNIVERSITIES registry");

  const universities = [...registryBlock.matchAll(/\{([^{}]*)\}/g)].map((match) => {
    const record = match[1];
    return {
      slug: field(record, "slug") ?? null,
      code: field(record, "code") ?? null,
      name: field(record, "name") ?? null,
      city: field(record, "city") ?? null,
      status: field(record, "status") ?? null,
      officialUrl: field(record, "officialUrl") ?? null,
    };
  });
  const postRecords = [...blogSource.matchAll(/\{([\s\S]*?)\n\s*\},?/g)]
    .map((match) => match[1])
    .map((record) => ({
      slug: field(record, "slug"),
      title: field(record, "title"),
      date: field(record, "date"),
      summary: field(record, "summary"),
    }))
    .filter((record) => record.slug && record.title);
  const posts = postRecords.map((record) => record.slug);
  const affiliationBoundary = readAffiliationBoundary(universitiesSource);

  return { universities, posts, postRecords, affiliationBoundary };
}

export function buildRoutes({ universities, posts }) {
  const core = ["/", "/pricing", "/unis", "/blog/", "/changelog", "/legal/terms", "/legal/privacy"];
  const blog = posts.map((slug) => `/blog/${slug}`);
  const university = universities
    .filter((record) => record.slug)
    .map((record) => `/unis/${record.slug}`);
  return [...core, ...blog, ...university];
}

export function artifactFor(route) {
  if (route === "/") return "index.html";
  if (route === "/blog/rss.xml") return "blog/rss.xml";
  return `${route.replace(/\/$/, "")}/index.html`.replace(/^\//, "");
}

const CORE_ROUTE_EXPECTATIONS = {
  "/": {
    title: "Vuzora – расписание вуза в Telegram каждое утро",
    heading: "Расписание твоего вуза. Каждое утро.",
    internalLinks: ["/pricing", "/unis", "/blog", "/changelog", "/legal/terms", "/legal/privacy"],
    jsonLdTypes: ["SoftwareApplication", "FAQPage"],
    jsonLdIdentity: [
      { type: "SoftwareApplication", name: "Vuzora", url: "https://t.me/vuzora_bot" },
    ],
    ctas: [
      { marker: "generic-conversion", href: "https://t.me/vuzora_bot?start=from-site", count: 4 },
      { marker: "bot-navigation", href: "https://t.me/vuzora_bot", count: 4 },
      { marker: "support", href: "https://t.me/vuzora_support_bot", count: 1 },
    ],
  },
  "/pricing": {
    title: "Тарифы Vuzora – подписка от 49 ₽",
    heading: "Тарифы и подписка Vuzora",
    internalLinks: ["/pricing", "/unis", "/blog"],
    jsonLdTypes: ["Product", "BreadcrumbList"],
    jsonLdIdentity: [{ type: "Product", name: "Vuzora — подписка" }],
    ctas: [
      { marker: "generic-conversion", href: "https://t.me/vuzora_bot?start=from-site", count: 1 },
      { marker: "bot-navigation", href: "https://t.me/vuzora_bot", count: 4 },
    ],
  },
  "/unis": {
    title: "Поддерживаемые вузы – Vuzora",
    heading: "Поддерживаемые вузы",
    internalLinks: ["/unis", "/pricing", "/blog"],
    jsonLdTypes: ["ItemList", "BreadcrumbList"],
    jsonLdIdentity: [
      {
        type: "ItemList",
        "@id": "https://vuzora.ru/unis#directory",
        name: "Поддерживаемые вузы – Vuzora",
        url: "https://vuzora.ru/unis",
      },
    ],
    ctas: [
      { marker: "support", href: "https://t.me/vuzora_support_bot", count: 1 },
      { marker: "bot-navigation", href: "https://t.me/vuzora_bot", count: 4 },
    ],
  },
  "/blog/": {
    title: "Блог – Vuzora",
    heading: "Блог Vuzora",
    internalLinks: ["/blog", "/pricing", "/unis", "/changelog", "/legal/terms", "/legal/privacy"],
    jsonLdTypes: ["Blog"],
    jsonLdIdentity: [
      {
        type: "Blog",
        "@id": "https://vuzora.ru/blog#blog",
        name: "Блог – Vuzora",
        url: "https://vuzora.ru/blog",
      },
    ],
    ctas: [{ marker: "bot-navigation", href: "https://t.me/vuzora_bot", count: 4 }],
  },
  "/changelog": {
    title: "Что нового – Vuzora",
    heading: "Что нового",
    internalLinks: ["/changelog", "/pricing", "/unis", "/blog", "/legal/terms", "/legal/privacy"],
    jsonLdTypes: ["BreadcrumbList"],
    jsonLdIdentity: [
      {
        type: "BreadcrumbList",
        "@id": "https://vuzora.ru/changelog#breadcrumb",
        name: "Что нового – Vuzora",
        url: "https://vuzora.ru/changelog",
      },
    ],
    ctas: [{ marker: "bot-navigation", href: "https://t.me/vuzora_bot", count: 4 }],
  },
  "/legal/terms": {
    title: "Публичная оферта – Vuzora",
    heading: "Публичная оферта",
    internalLinks: ["/", "/pricing"],
    jsonLdTypes: ["BreadcrumbList"],
    jsonLdIdentity: [
      {
        type: "BreadcrumbList",
        "@id": "https://vuzora.ru/legal/terms#breadcrumb",
        name: "Публичная оферта – Vuzora",
        url: "https://vuzora.ru/legal/terms",
      },
    ],
    ctas: [
      { marker: "bot-navigation", href: "https://t.me/vuzora_bot", count: 1 },
      { marker: "support", href: "https://t.me/vuzora_support_bot", count: 1 },
    ],
  },
  "/legal/privacy": {
    title: "Политика конфиденциальности – Vuzora",
    heading: "Политика конфиденциальности",
    internalLinks: ["/"],
    jsonLdTypes: ["BreadcrumbList"],
    jsonLdIdentity: [
      {
        type: "BreadcrumbList",
        "@id": "https://vuzora.ru/legal/privacy#breadcrumb",
        name: "Политика конфиденциальности – Vuzora",
        url: "https://vuzora.ru/legal/privacy",
      },
    ],
    ctas: [{ marker: "support", href: "https://t.me/vuzora_support_bot", count: 1 }],
  },
};

export function routeExpectationFor(route, { postRecords = [], universities = [] } = {}) {
  if (CORE_ROUTE_EXPECTATIONS[route]) return CORE_ROUTE_EXPECTATIONS[route];
  if (route.startsWith("/unis/")) {
    const slug = route.slice("/unis/".length);
    const university = universities.find((record) => record.slug === slug);
    if (university) {
      return {
        heading: university.name,
        internalLinks: ["/unis"],
        jsonLdTypes: ["BreadcrumbList", "CollegeOrUniversity", "Service"],
        jsonLdIdentity: [
          {
            type: "CollegeOrUniversity",
            "@id": `https://vuzora.ru${route}#university`,
            name: university.name,
            url: `https://vuzora.ru${route}`,
          },
          {
            type: "Service",
            "@id": "https://vuzora.ru/#service",
            about: `https://vuzora.ru${route}#university`,
          },
        ],
        ctas: [
          {
            marker: "university-conversion",
            href: `https://t.me/vuzora_bot?start=from-site_${university.slug}`,
            count: 1,
          },
          { marker: "bot-navigation", href: "https://t.me/vuzora_bot", count: 4 },
        ],
      };
    }
  }
  if (route.startsWith("/blog/")) {
    const slug = route.slice("/blog/".length);
    const post = postRecords.find((record) => record.slug === slug);
    if (post) {
      return {
        title: `${post.title} – Vuzora`,
        heading: post.title,
        internalLinks: [
          "/blog",
          "/pricing",
          "/unis",
          "/changelog",
          "/legal/terms",
          "/legal/privacy",
        ],
        jsonLdTypes: ["BlogPosting", "BreadcrumbList"],
        jsonLdIdentity: [
          {
            type: "BlogPosting",
            "@id": `https://vuzora.ru${route}#post`,
            url: `https://vuzora.ru${route}`,
          },
        ],
        ctas: [
          {
            marker: "generic-conversion",
            href: "https://t.me/vuzora_bot?start=from-site",
            count: 1,
          },
          { marker: "bot-navigation", href: "https://t.me/vuzora_bot", count: 4 },
        ],
      };
    }
  }
  return undefined;
}

export function manifestFor({ universities, posts }) {
  return {
    universities: universities.map((record) => ({ ...record })),
    posts: [...posts],
  };
}
