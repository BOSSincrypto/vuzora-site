import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import {
  artifactFor,
  buildRoutes,
  manifestFor,
  readRegistry,
  routeExpectationFor,
} from "./route-policy.mjs";
import {
  assertLlmsJoin,
  assertRobotsPolicy,
  assertRobotsAllowsLlms,
  buildLlmsPacket,
  deriveDiscoveryRoutes,
} from "./llms-packet.mjs";
import { assertRssJoin, buildRssFeed, RSS_PATH } from "./rss-feed.mjs";
import { assertBlogIndexJoin, assertEditorialGraph } from "./editorial-joins.mjs";
import { BLOG_INDEX_ROUTE, assertBlogMetadataConsistency } from "./blog-metadata.mjs";
import { assertAgentSkillsRelease } from "./agent-skills.mjs";
import { assertApiCatalogRelease } from "./api-catalog.mjs";
import { assertDiscoveryBoundaryRelease } from "./discovery-boundaries.mjs";

export const CANONICAL_ORIGIN = "https://vuzora.ru";
export const GENERIC_CTA = "https://t.me/vuzora_bot?start=from-site";
export const SUPPORT_CTA = "https://t.me/vuzora_support_bot";

const PLACEHOLDER_RE = /\b(?:undefined|null|todo|lorem ipsum|placeholder)\b/i;
const ANALYTICS_RE =
  /\b(?:plausible\.io|plausible\.io\/js|data-domain|google-analytics|googletagmanager|gtag\s*\(|GA_MEASUREMENT|yandex(?:\.ru)?\/metrika|mc\.yandex|metrika\.yandex|hotjar|segment\.com|fullstory|mixpanel|amplitude\.com)\b/i;
const HTML_ENTITY_RE = /&(?:amp|lt|gt|quot|apos|#x[\da-f]+|#\d+);/gi;
const HTML_ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

export function decodeHtmlEntities(value) {
  return value.replace(HTML_ENTITY_RE, (entity) => {
    const body = entity.slice(1, -1);
    if (body.startsWith("#x")) return String.fromCodePoint(Number.parseInt(body.slice(2), 16));
    if (body.startsWith("#")) return String.fromCodePoint(Number.parseInt(body.slice(1), 10));
    return HTML_ENTITIES[body] ?? entity;
  });
}

function parseAttributes(source) {
  const attrs = {};
  const attributeRe = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  for (const match of source.matchAll(attributeRe)) {
    const name = match[1].toLowerCase();
    attrs[name] = decodeHtmlEntities(match[2] ?? match[3] ?? match[4] ?? "");
  }
  return attrs;
}

function textContent(value) {
  return decodeHtmlEntities(
    value
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<script\b[\s\S]*?<\/script>/gi, "")
      .replace(/<style\b[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

export function parseHtmlDocument(html) {
  const elements = [];
  const tagRe = /<([a-z][\w:-]*)(\s[\s\S]*?)?\/?\s*>/gi;
  for (const match of html.matchAll(tagRe)) {
    elements.push({ tag: match[1].toLowerCase(), attrs: parseAttributes(match[2] ?? "") });
  }
  const findAll = (tag) => elements.filter((element) => element.tag === tag);
  const findMeta = (key, value) =>
    findAll("meta").filter((element) => element.attrs[key] === value);
  const titleMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const description = findAll("meta").filter(
    (element) => element.attrs.name?.toLowerCase() === "description",
  );
  const canonical = findAll("link").filter((element) =>
    element.attrs.rel?.toLowerCase().split(/\s+/).includes("canonical"),
  );
  const alternateLinks = findAll("link").filter((element) =>
    element.attrs.rel?.toLowerCase().split(/\s+/).includes("alternate"),
  );
  const htmlTag = elements.find((element) => element.tag === "html");
  const headings = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((match) =>
    textContent(match[1]),
  );
  const faqSection = html.match(/<section\b[^>]*data-section=["']faq["'][^>]*>([\s\S]*?)<\/section>/i)?.[1] ?? "";
  const faq = [...faqSection.matchAll(/<details\b[^>]*>([\s\S]*?)<\/details>/gi)].map((match) => {
    const item = match[1];
    const summary = item.match(/<summary\b[^>]*>([\s\S]*?)<\/summary>/i)?.[1] ?? "";
    // Prefer the first content span so decorative accordion markers ("+") are ignored.
    const questionSource =
      summary.match(/<span\b[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? summary;
    return {
      question: textContent(questionSource),
      answer: textContent(item.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? ""),
    };
  });
  const anchors = findAll("a").map((element) => element.attrs);
  const jsonLd = [
    ...html.matchAll(
      /<script\b([^>]*\btype\s*=\s*["']application\/ld\+json["'][^>]*)>([\s\S]*?)<\/script>/gi,
    ),
  ].map((match) => ({ attrs: parseAttributes(match[1]), source: match[2].trim() }));
  const parsedJsonLd = [];
  for (const script of jsonLd) {
    try {
      parsedJsonLd.push(JSON.parse(script.source));
    } catch (error) {
      throw new Error(`invalid JSON-LD: ${error.message}`);
    }
  }
  const meta = (key, value) => findMeta(key, value).map((element) => element.attrs.content ?? "");

  return {
    html,
    elements,
    anchors,
    headings,
    faq,
    text: textContent(html),
    title: titleMatch ? textContent(titleMatch[1]) : "",
    descriptions: description.map((element) => element.attrs.content ?? ""),
    canonicals: canonical.map((element) => element.attrs.href ?? ""),
    alternateLinks: alternateLinks.map((element) => element.attrs),
    htmlLang: htmlTag?.attrs.lang ?? "",
    meta,
    jsonLd: parsedJsonLd,
  };
}

export function routeMetadataFailures(document, route, expectedDescription) {
  const failures = [];
  if (document.htmlLang !== "ru") failures.push(`${route}: HTML language must be ru`);
  if (
    document.descriptions.length !== 1 ||
    document.descriptions[0].length < 50 ||
    document.descriptions[0].length > 170 ||
    PLACEHOLDER_RE.test(document.descriptions[0] ?? "")
  )
    failures.push(`${route}: description is missing, duplicated, placeholder, or out of bounds`);
  if (
    expectedDescription !== undefined &&
    (document.descriptions.length !== 1 || document.descriptions[0] !== expectedDescription)
  )
    failures.push(`${route}: route-specific description mismatch`);
  const locale = document.meta("property", "og:locale");
  if (locale.length !== 1 || locale[0] !== "ru_RU")
    failures.push(`${route}: Russian OpenGraph locale is missing or duplicated`);
  const robots = document.meta("name", "robots");
  const robotTokens = (robots[0] ?? "")
    .toLowerCase()
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
  if (
    robots.length !== 1 ||
    !robotTokens.includes("index") ||
    !robotTokens.includes("follow") ||
    robotTokens.includes("noindex") ||
    robotTokens.includes("nofollow")
  )
    failures.push(`${route}: robots metadata must resolve to index, follow`);
  const expectedCanonical = `${CANONICAL_ORIGIN}${route}`;
  if (document.canonicals.length !== 1 || document.canonicals[0] !== expectedCanonical)
    failures.push(`${route}: canonical mismatch`);
  const expectedDiscoveryLinks = [
    {
      href: `${CANONICAL_ORIGIN}/blog/rss.xml`,
      type: "application/rss+xml",
    },
    { href: `${CANONICAL_ORIGIN}/llms.txt`, type: "text/plain" },
  ];
  if (document.alternateLinks.length !== expectedDiscoveryLinks.length) {
    failures.push(
      `${route}: discovery metadata must contain exactly ${expectedDiscoveryLinks.length} alternate links`,
    );
  }
  for (const expected of expectedDiscoveryLinks) {
    const matching = document.alternateLinks.filter(
      (link) =>
        link.rel === "alternate" &&
        link.href === expected.href &&
        link.type === expected.type,
    );
    if (matching.length !== 1)
      failures.push(`${route}: expected exactly one ${expected.type} discovery link`);
  }
  const expectedDiscoverySet = new Set(
    expectedDiscoveryLinks.map(({ href, type }) => `${href}\u0000${type}`),
  );
  const unexpectedDiscovery = document.alternateLinks.filter(
    (link) =>
      link.rel !== "alternate" ||
      !expectedDiscoverySet.has(`${link.href ?? ""}\u0000${link.type ?? ""}`),
  );
  if (unexpectedDiscovery.length) {
    failures.push(
      `${route}: discovery metadata contains unrelated, non-canonical, duplicate, or wrong-origin alternate link(s)`,
    );
  }
  return failures;
}

export function assertUniversityCtaOrder(document, university, route) {
  const identityMatch = document.html.match(
    /<header\b[^>]*\bdata-identity-status(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?[^>]*>[\s\S]*?<\/header>/i,
  );
  const detailContentMatch = document.html.match(/<div\b[^>]*\bdata-detail-content(?:\s|=|>)[^>]*>/i);
  if (!identityMatch) throw new Error(`${route}: missing identity/status marker`);
  if (!detailContentMatch) throw new Error(`${route}: missing detail-content marker`);

  const identityEnd = (identityMatch.index ?? 0) + identityMatch[0].length;
  const detailStart = detailContentMatch.index ?? -1;
  if (detailStart < identityEnd)
    throw new Error(`${route}: detail content precedes identity/status block`);

  const interval = document.html.slice(identityEnd, detailStart);
  const intervalAnchors = [...interval.matchAll(/<a\b([^>]*)>/gi)].map((match) =>
    parseAttributes(match[1] ?? ""),
  );
  const marked = intervalAnchors.filter(
    (anchor) => anchor["data-cta"] === "university-conversion",
  );
  const universityScoped = intervalAnchors.filter((anchor) =>
    (anchor.href ?? "").startsWith("https://t.me/vuzora_bot?start=from-site_"),
  );
  const expectedHref = `https://t.me/vuzora_bot?start=from-site_${university.slug}`;
  if (!/^\s*<a\b/i.test(interval))
    throw new Error(`${route}: university CTA does not immediately follow identity/status block`);
  if (marked.length !== 1)
    throw new Error(`${route}: primary university CTA expected exactly once, found ${marked.length}`);
  if (universityScoped.length !== 1)
    throw new Error(
      `${route}: primary content surface contains ${universityScoped.length} university-scoped CTAs`,
    );
  const [cta] = marked;
  if (
    cta.href !== expectedHref ||
    cta.target !== "_blank" ||
    cta.rel !== "noopener noreferrer"
  )
    throw new Error(`${route}: primary university CTA has incorrect destination or safe attributes`);
}

function sameValue(left, right) {
  if (Object.is(left, right)) return true;
  if (typeof left !== typeof right || left === null || right === null) return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => sameValue(value, right[index]))
    );
  }
  if (typeof left === "object") {
    const leftKeys = Object.keys(left).sort();
    const rightKeys = Object.keys(right).sort();
    return (
      leftKeys.length === rightKeys.length &&
      leftKeys.every((key, index) => key === rightKeys[index] && sameValue(left[key], right[key]))
    );
  }
  return false;
}

export function assertManifest(actual, expected) {
  if (!sameValue(actual, expected)) {
    throw new Error("dist/release-manifest.json disagrees with the source registries");
  }
}

const CTA_MARKERS = new Set([
  "generic-conversion",
  "university-conversion",
  "support",
  "bot-navigation",
]);

function expectedMarkerForHref(href) {
  if (href === GENERIC_CTA) return "generic-conversion";
  if (href === SUPPORT_CTA) return "support";
  if (href === "https://t.me/vuzora_bot") return "bot-navigation";
  if (/^https:\/\/t\.me\/vuzora_bot\?start=from-site_[a-z0-9-]+$/.test(href))
    return "university-conversion";
  return undefined;
}

function validateExternalAnchors(document, failures, route) {
  for (const anchor of document.anchors) {
    const href = anchor.href ?? "";
    const isTelegram = href.startsWith("https://t.me/");
    const isExternalHttp = /^https?:\/\//.test(href) && !href.startsWith(CANONICAL_ORIGIN);
    if (!isTelegram && !isExternalHttp) continue;
    if (isTelegram && !expectedMarkerForHref(href))
      failures.push(`${route}: unsupported Telegram destination ${href}`);
    if (anchor.target !== "_blank")
      failures.push(`${route}: external anchor must use target=_blank`);
    if (anchor.rel !== "noopener noreferrer")
      failures.push(`${route}: external anchor must use rel=noopener noreferrer`);
    if (isTelegram && !CTA_MARKERS.has(anchor["data-cta"]))
      failures.push(`${route}: Telegram anchor ${href} is missing a semantic data-cta marker`);
  }
}

function validateCtaExpectations(document, expectation, failures, route) {
  const marked = document.anchors.filter((anchor) => anchor["data-cta"]);
  const expectedMarkers = new Set((expectation.ctas ?? []).map((cta) => cta.marker));
  for (const anchor of marked) {
    const marker = anchor["data-cta"];
    if (!CTA_MARKERS.has(marker)) failures.push(`${route}: unsupported data-cta marker ${marker}`);
    if (!expectedMarkers.has(marker))
      failures.push(`${route}: unexpected data-cta marker ${marker}`);
  }
  for (const cta of expectation.ctas ?? []) {
    const matching = document.anchors.filter((anchor) => anchor["data-cta"] === cta.marker);
    if (matching.length !== cta.count)
      failures.push(
        `${route}: data-cta=${cta.marker} expected ${cta.count} anchors, found ${matching.length}`,
      );
    if (matching.some((anchor) => anchor.href !== cta.href))
      failures.push(`${route}: data-cta=${cta.marker} has an incorrect destination`);
    if (
      matching.some((anchor) => anchor.target !== "_blank" || anchor.rel !== "noopener noreferrer")
    )
      failures.push(`${route}: data-cta=${cta.marker} has unsafe external attributes`);
  }
}

function flattenJsonLd(value) {
  if (Array.isArray(value)) return value.flatMap(flattenJsonLd);
  if (!value || typeof value !== "object") return [];
  return value["@graph"] ? [value, ...flattenJsonLd(value["@graph"])] : [value];
}

export function validateRouteDocument(
  document,
  route,
  expectedRoutes,
  universities,
  failures,
  knownTitles = new Set(),
  knownCanonicals = new Set(),
  routeExpectations,
  affiliationBoundary,
  postRecords = [],
) {
  const expectation =
    routeExpectations?.[route] ?? routeExpectationFor(route, { universities, postRecords });
  if (!expectation) failures.push(`${route}: missing explicit route expectation`);
  if (!/^<!doctype html>/i.test(document.html)) failures.push(`${route}: invalid HTML doctype`);
  if (document.headings.length !== 1) failures.push(`${route}: expected exactly one H1`);
  if (
    document.title.length < 10 ||
    document.title.length > 70 ||
    PLACEHOLDER_RE.test(document.title)
  )
    failures.push(`${route}: title is missing, placeholder, or out of bounds`);
  const expectedCanonical = `${CANONICAL_ORIGIN}${route}`;
  failures.push(...routeMetadataFailures(document, route, expectation?.description));
  if (
    document.meta("property", "og:url").length !== 1 ||
    document.meta("property", "og:url")[0] !== expectedCanonical
  )
    failures.push(`${route}: og:url mismatch`);
  const expectedOgType =
    route.startsWith("/blog/") && route !== BLOG_INDEX_ROUTE ? "article" : "website";
  if (
    document.meta("property", "og:type").length !== 1 ||
    document.meta("property", "og:type")[0] !== expectedOgType
  )
    failures.push(`${route}: og:type must be exactly ${expectedOgType}`);
  for (const [key, value] of [
    ["property", "og:title"],
    ["property", "og:description"],
    ["name", "twitter:card"],
    ["name", "twitter:title"],
    ["name", "twitter:description"],
  ]) {
    const values = document.meta(key, value);
    if (values.length !== 1 || !values[0]) failures.push(`${route}: missing or duplicate ${value}`);
  }
  if (expectation) {
    if (expectation.title !== undefined && document.title !== expectation.title)
      failures.push(`${route}: route-specific title mismatch`);
    if (expectation.heading !== undefined && document.headings[0] !== expectation.heading)
      failures.push(`${route}: route-specific H1 mismatch`);
    for (const href of expectation.internalLinks ?? []) {
      if (!document.anchors.some((anchor) => anchor.href === href))
        failures.push(`${route}: missing expected internal link ${href}`);
    }
    const jsonLdTypes = document.jsonLd.flatMap(flattenJsonLd).map((node) => node["@type"]);
    for (const type of expectation.jsonLdTypes ?? []) {
      if (!jsonLdTypes.includes(type)) failures.push(`${route}: missing JSON-LD type ${type}`);
    }
    const jsonLdNodes = document.jsonLd.flatMap(flattenJsonLd);
    for (const identity of expectation.jsonLdIdentity ?? []) {
      const candidates = jsonLdNodes.filter((candidate) => candidate["@type"] === identity.type);
      const matches = candidates.filter((candidate) =>
        Object.entries(identity).every(
          ([key, value]) => candidate[key === "type" ? "@type" : key] === value,
        ),
      );
      if (candidates.length !== 1 || matches.length !== 1)
        failures.push(`${route}: JSON-LD identity mismatch for ${identity.type}`);
    }
    validateCtaExpectations(document, expectation, failures, route);
  }
  if (knownTitles.has(document.title))
    failures.push(`${route}: copied route title ${document.title}`);
  if (knownCanonicals.has(expectedCanonical))
    failures.push(`${route}: duplicate canonical ${expectedCanonical}`);
  knownTitles.add(document.title);
  knownCanonicals.add(expectedCanonical);
  if (!document.anchors.some((anchor) => (anchor.href ?? "").startsWith("/")))
    failures.push(`${route}: missing internal link marker`);
  for (const value of document.jsonLd) {
    const nodes = flattenJsonLd(value);
    for (const node of nodes) {
      if (
        node["@id"] &&
        typeof node["@id"] === "string" &&
        node["@id"].startsWith("http") &&
        !node["@id"].startsWith(CANONICAL_ORIGIN)
      )
        failures.push(`${route}: JSON-LD uses alternate origin`);
    }
  }
  if (
    ["/", "/unis", ...universities.filter((u) => u.slug).map((u) => `/unis/${u.slug}`)].includes(
      route,
    )
  ) {
    const ogImage = document.meta("property", "og:image");
    const twitterImage = document.meta("name", "twitter:image");
    if (
      ogImage.length !== 1 ||
      !ogImage[0] ||
      twitterImage.length !== 1 ||
      twitterImage[0] !== ogImage[0]
    )
      failures.push(`${route}: social image markers are missing or disagree`);
  }
  validateExternalAnchors(document, failures, route);
  if (route.startsWith("/unis/")) {
    const university = universities.find((record) => record.slug === route.slice("/unis/".length));
    if (!university) failures.push(`${route}: route is not registry-derived`);
    else {
      if (document.headings.length !== 1 || !document.headings[0].includes(university.name))
        failures.push(`${route}: H1 does not identify the registry university`);
      if (!document.text.includes(university.city))
        failures.push(`${route}: city identity is missing`);
      if (!document.text.includes(university.status === "online" ? "Онлайн" : "Скоро"))
        failures.push(`${route}: status identity is missing`);
      if (!document.title.includes(university.name))
        failures.push(`${route}: title must include the full registry name`);
      if (!(document.descriptions[0] ?? "").includes(university.name))
        failures.push(`${route}: description must include the registry name`);
      // Social titles must stay in parity with the document title (and thus the full name).
      const ogTitle = document.meta("property", "og:title")[0] ?? "";
      const twitterTitle = document.meta("name", "twitter:title")[0] ?? "";
      if (ogTitle !== document.title)
        failures.push(`${route}: og:title must match document title`);
      if (twitterTitle !== document.title)
        failures.push(`${route}: twitter:title must match document title`);
      if (!affiliationBoundary)
        failures.push(`${route}: affiliation-boundary wording is not configured from registry`);
      else if (!document.text.includes(affiliationBoundary))
        failures.push(`${route}: affiliation-boundary wording is missing`);
      const expectedCta = `https://t.me/vuzora_bot?start=from-site_${university.slug}`;
      const universityCtas = document.anchors.filter((anchor) =>
        anchor.href?.startsWith("https://t.me/vuzora_bot?start=from-site_"),
      );
      if (
        universityCtas.length === 0 ||
        universityCtas.some((anchor) => anchor.href !== expectedCta)
      )
        failures.push(`${route}: university CTA is missing or cross-route`);
      try {
        assertUniversityCtaOrder(document, university, route);
      } catch (error) {
        failures.push(error.message);
      }
      const externalUniversityAnchors = document.anchors.filter(
        (anchor) =>
          /^https?:\/\//.test(anchor.href ?? "") &&
          !anchor.href.startsWith("https://t.me/") &&
          !anchor.href.startsWith(CANONICAL_ORIGIN),
      );
      if (university.officialUrl) {
        const officialAnchors = document.anchors.filter(
          (anchor) => anchor.href === university.officialUrl,
        );
        if (officialAnchors.length !== 1)
          failures.push(`${route}: official link does not match registry`);
        if (
          officialAnchors.some(
            (anchor) => anchor.target !== "_blank" || anchor.rel !== "noopener noreferrer",
          )
        )
          failures.push(`${route}: official link has unsafe external attributes`);
        if (externalUniversityAnchors.some((anchor) => anchor.href !== university.officialUrl))
          failures.push(`${route}: external university link is not the registry official URL`);
      } else if (externalUniversityAnchors.length) {
        // Registry omission is authoritative: no third-party university homepage link.
        failures.push(`${route}: unverified official link rendered without registry URL`);
      }
      const nodes = document.jsonLd.flatMap(flattenJsonLd);
      const typeOf = (node) =>
        Array.isArray(node?.["@type"]) ? node["@type"] : node?.["@type"] ? [node["@type"]] : [];
      const breadcrumbs = nodes.filter((node) => typeOf(node).includes("BreadcrumbList"));
      const entities = nodes.filter((node) => typeOf(node).includes("CollegeOrUniversity"));
      const services = nodes.filter((node) => typeOf(node).includes("Service"));
      const faqPages = nodes.filter((node) => typeOf(node).includes("FAQPage"));
      if (
        breadcrumbs.length !== 1 ||
        entities.length !== 1 ||
        services.length !== 1 ||
        faqPages.length !== 1
      )
        failures.push(
          `${route}: JSON-LD must contain exactly one BreadcrumbList, CollegeOrUniversity, Service, and FAQPage`,
        );
      const entity = entities[0];
      if (
        entity &&
        (entity["@id"] !== `${CANONICAL_ORIGIN}${route}#university` ||
          entity.url !== `${CANONICAL_ORIGIN}${route}` ||
          entity.name !== university.name ||
          entity.address?.addressLocality !== university.city)
      )
        failures.push(`${route}: JSON-LD university identity mismatch`);
      if (entity) {
        const sameAsValues = Array.isArray(entity.sameAs)
          ? entity.sameAs
          : entity.sameAs
            ? [entity.sameAs]
            : [];
        if (university.officialUrl) {
          if (sameAsValues.length !== 1 || sameAsValues[0] !== university.officialUrl)
            failures.push(`${route}: JSON-LD sameAs must equal the registry officialUrl`);
        } else if (sameAsValues.length) {
          failures.push(`${route}: JSON-LD sameAs invented without registry officialUrl`);
        }
      }
      const service = services[0];
      if (
        service &&
        (service["@id"] !== `${CANONICAL_ORIGIN}/#service` ||
          service.about !== `${CANONICAL_ORIGIN}${route}#university` ||
          service.provider?.["@id"] !== `${CANONICAL_ORIGIN}/#org` ||
          !service.serviceType)
      )
        failures.push(`${route}: JSON-LD service relationship mismatch`);
      const breadcrumb = breadcrumbs[0];
      const items = breadcrumb?.itemListElement;
      if (
        !Array.isArray(items) ||
        items.length !== 3 ||
        items[0]?.name !== "Главная" ||
        items[0]?.item !== `${CANONICAL_ORIGIN}/` ||
        items[1]?.name !== "Вузы" ||
        items[1]?.item !== `${CANONICAL_ORIGIN}/unis` ||
        items[2]?.name !== university.name ||
        items[2]?.item !== `${CANONICAL_ORIGIN}${route}`
      )
        failures.push(`${route}: JSON-LD breadcrumb positions/URLs mismatch`);
      const visibleFaq = document.faq.filter((item) => item.question && item.answer);
      if (visibleFaq.length < 3 || visibleFaq.length > 5)
        failures.push(`${route}: visible FAQ must contain 3–5 Q&A pairs`);
      const faqPage = faqPages[0];
      const mainEntity = faqPage?.mainEntity;
      if (!Array.isArray(mainEntity) || mainEntity.length < 3 || mainEntity.length > 5)
        failures.push(`${route}: FAQPage mainEntity must contain 3–5 Question nodes`);
      else if (mainEntity.length !== visibleFaq.length)
        failures.push(`${route}: FAQPage Q&A count does not match visible FAQ`);
      else {
        for (let index = 0; index < mainEntity.length; index += 1) {
          const question = mainEntity[index];
          const answerText =
            question?.acceptedAnswer?.text ??
            question?.acceptedAnswer?.["@value"] ??
            (typeof question?.acceptedAnswer === "string" ? question.acceptedAnswer : "");
          const questionName = typeof question?.name === "string" ? question.name.trim() : "";
          const answerNormalized = typeof answerText === "string" ? answerText.trim() : "";
          if (
            !typeOf(question).includes("Question") ||
            !questionName ||
            !answerNormalized ||
            !question?.acceptedAnswer ||
            (question.acceptedAnswer["@type"] &&
              !typeOf(question.acceptedAnswer).includes("Answer"))
          ) {
            failures.push(`${route}: FAQPage Question/Answer shape is invalid at index ${index}`);
            continue;
          }
          if (
            questionName !== visibleFaq[index].question ||
            answerNormalized !== visibleFaq[index].answer
          )
            failures.push(`${route}: FAQPage Q&A does not match visible FAQ at index ${index}`);
        }
      }
    }
  }
  if (ANALYTICS_RE.test(document.html))
    failures.push(`${route}: analytics or collector reference found in initial HTML`);
  if (route === "/unis") {
    for (const university of universities.filter((record) => record.slug)) {
      const href = `/unis/${university.slug}`;
      if (
        !document.anchors.some(
          (anchor) => anchor.href === href && document.text.includes(university.name),
        )
      )
        failures.push(`${route}: missing registry university link ${href}`);
    }
  }
  if (expectedRoutes.length === 0) failures.push("route policy is empty");
  if (route === BLOG_INDEX_ROUTE || route.startsWith("/blog/")) {
    try {
      assertBlogMetadataConsistency(document.html, route, postRecords);
    } catch (error) {
      failures.push(`Blog metadata: ${error.message}`);
    }
  }
}

export function parseSitemapXml(xml) {
  const tokens = [...xml.matchAll(/<!--[\s\S]*?-->|<\?[^>]*\?>|<[^>]+>|[^<]+/g)].map(
    (match) => match[0],
  );
  const stack = [];
  const entries = [];
  let current;
  for (const token of tokens) {
    if (token.startsWith("<!--") || token.startsWith("<?")) continue;
    if (token.startsWith("<")) {
      const close = token.match(/^<\/\s*([\w:.-]+)\s*>$/);
      if (close) {
        const name = close[1];
        if (stack.pop() !== name) throw new Error(`malformed sitemap closing tag ${name}`);
        if (current?._field === name) current._field = undefined;
        if (name === "url") {
          if (!current?.loc) throw new Error("sitemap url is missing loc");
          entries.push(current);
          current = undefined;
        }
        continue;
      }
      const open = token.match(/^<\s*([\w:.-]+)(?:\s[^>]*)?\s*(\/?)>$/);
      if (!open) throw new Error("malformed sitemap XML token");
      const name = open[1];
      if (open[2]) throw new Error(`unexpected self-closing sitemap tag ${name}`);
      stack.push(name);
      if (name === "urlset" && stack.length !== 1)
        throw new Error("urlset must be the sitemap root");
      if (name === "url") {
        if (stack.length !== 2 || current) throw new Error("invalid sitemap url nesting");
        current = { _fields: new Set() };
      } else if (
        stack.length === 3 &&
        current &&
        ["loc", "lastmod", "changefreq", "priority"].includes(name)
      ) {
        if (current._fields.has(name)) throw new Error(`duplicate sitemap field ${name}`);
        current._fields.add(name);
        current._field = name;
      } else if (name !== "urlset" && name !== "url" && stack.length !== 3) {
        throw new Error(`unexpected sitemap element ${name}`);
      }
    } else if (current?._field) {
      current[current._field] = decodeHtmlEntities(token.trim());
    } else if (token.trim()) {
      throw new Error("unexpected sitemap text");
    }
    if (token.startsWith("</") && current?._field) current._field = undefined;
  }
  if (stack.length || entries.length === 0) throw new Error("sitemap XML is incomplete");
  return entries.map(({ _field, _fields, ...entry }) => entry);
}

export function assertSitemap(xml, routes, artifactExists = () => true, includeRss = false) {
  const entries = parseSitemapXml(xml);
  const locs = entries.map((entry) => entry.loc);
  const expectedRoutes = includeRss ? [...routes, RSS_PATH] : routes;
  const expected = expectedRoutes.map((route) => `${CANONICAL_ORIGIN}${route}`);
  if (new Set(locs).size !== locs.length)
    throw new Error("sitemap.xml contains duplicate loc entries");
  if (locs.some((loc) => !/^https:\/\/vuzora\.ru\/(?:[^?#]+)?$/.test(loc)))
    throw new Error("sitemap.xml contains a non-canonical locator");
  if (locs.length !== expected.length || expected.some((loc) => !locs.includes(loc)))
    throw new Error(
      `sitemap route set mismatch: expected ${expected.length}, found ${locs.length}`,
    );
  for (const entry of entries) {
    const route = entry.loc.slice(CANONICAL_ORIGIN.length);
    if (!artifactExists(artifactFor(route)))
      throw new Error(`sitemap locator has no matching artifact: ${entry.loc}`);
    if (entry.lastmod && !/^\d{4}-\d{2}-\d{2}$/.test(entry.lastmod))
      throw new Error(`invalid sitemap lastmod: ${entry.lastmod}`);
  }
  return entries;
}

export function assertIndependent404(document, routes, universities, homepageDocument) {
  if (document.headings.length !== 1) throw new Error("404.html must contain exactly one H1");
  if (!document.anchors.some((anchor) => anchor.href === "/"))
    throw new Error("404.html must link to /");
  const robots = document.meta("name", "robots");
  const robotTokens = (robots[0] ?? "")
    .toLowerCase()
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
  if (
    robots.length !== 1 ||
    !robotTokens.includes("noindex") ||
    robotTokens.includes("index") ||
    robotTokens.includes("follow")
  )
    throw new Error("404.html must remain explicitly noindex");
  if (!document.title || document.title === homepageDocument.title)
    throw new Error("404.html must have an independent title");
  if (document.canonicals.length) throw new Error("404.html must not expose a canonical");
  if (document.meta("property", "og:url").length)
    throw new Error("404.html must not expose og:url");
  if (document.text.includes(homepageDocument.headings[0]))
    throw new Error("404.html leaks homepage identity");
  if (document.html.includes(GENERIC_CTA)) throw new Error("404.html leaks homepage generic CTA");
  for (const route of routes)
    if (document.html.includes(`${CANONICAL_ORIGIN}${route}`))
      throw new Error(`404.html leaks supported canonical: ${route}`);
  for (const university of universities) {
    if (university.name && document.text.includes(university.name))
      throw new Error(`404.html leaks university identity: ${university.name}`);
    if (university.slug && document.html.includes(`from-site_${university.slug}`))
      throw new Error(`404.html leaks university CTA: ${university.slug}`);
  }
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function htmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await htmlFiles(path)));
    else if (entry.name.endsWith(".html")) files.push(path);
  }
  return files;
}

export async function validateRelease({ root = process.cwd(), dist = join(root, "dist") } = {}) {
  const failures = [];
  const fail = (message) => failures.push(message);
  const read = (path) => readFile(path, "utf8");
  const { universities, posts, postRecords, affiliationBoundary } = await readRegistry(root);
  const routes = buildRoutes({ universities, posts });
  const routeExpectations = Object.fromEntries(
    routes.map((route) => [route, routeExpectationFor(route, { universities, postRecords })]),
  );
  const expectedManifest = manifestFor({ universities, posts });
  const knownTitles = new Set();
  const knownCanonicals = new Set();
  const knownDescriptions = new Set();
  const routeDocuments = new Map();
  if (!(await exists(dist))) fail("missing dist directory");
  const manifestPath = join(dist, "release-manifest.json");
  if (!(await exists(manifestPath))) fail("missing dist/release-manifest.json");
  else {
    try {
      assertManifest(JSON.parse(await read(manifestPath)), expectedManifest);
    } catch (error) {
      fail(error.message);
    }
  }
  const slugSet = new Set();
  for (const university of universities) {
    if (university.slug) {
      if (!/^[a-z0-9-]+$/.test(university.slug))
        fail(`invalid university slug: ${university.slug}`);
      if (slugSet.has(university.slug)) fail(`duplicate university slug: ${university.slug}`);
      slugSet.add(university.slug);
    }
    if (!university.name || !university.city || !/^(online|soon)$/.test(university.status ?? ""))
      fail(`incomplete university registry record: ${university.slug ?? university.code}`);
  }
  if (await exists(dist)) {
    const routeArtifacts = new Set([...routes, RSS_PATH].map((route) => artifactFor(route)));
    const files = await htmlFiles(dist);
    const htmlArtifacts = files.map((path) => relative(dist, path));
    for (const route of routes) {
      const artifact = join(dist, artifactFor(route));
      if (!(await exists(artifact))) {
        fail(`missing route artifact: ${route} -> ${relative(root, artifact)}`);
        continue;
      }
      try {
        const document = parseHtmlDocument(await read(artifact));
        routeDocuments.set(route, document);
        validateRouteDocument(
          document,
          route,
          routes,
          universities,
          failures,
          knownTitles,
          knownCanonicals,
          routeExpectations,
          affiliationBoundary,
          postRecords,
        );
        const description = document.descriptions[0] ?? "";
        if (knownDescriptions.has(description))
          fail(`${route}: duplicate indexable route description`);
        knownDescriptions.add(description);
      } catch (error) {
        fail(`${route}: ${error.message}`);
      }
    }
    try {
      assertBlogIndexJoin(routeDocuments.get("/blog/"), postRecords);
    } catch (error) {
      fail(`Editorial blog index: ${error.message}`);
    }
    try {
      assertEditorialGraph({ documents: routeDocuments, posts: postRecords, universities });
    } catch (error) {
      fail(`Editorial graph: ${error.message}`);
    }
    const unexpected = htmlArtifacts.filter(
      (artifact) => artifact !== "404.html" && !routeArtifacts.has(artifact),
    );
    if (unexpected.length) fail(`unexpected route HTML artifacts: ${unexpected.join(", ")}`);
    for (const file of [
      "CNAME",
      ".nojekyll",
      "404.html",
      "robots.txt",
      "sitemap.xml",
      "llms.txt",
      "auth.md",
      RSS_PATH.replace(/^\//, ""),
    ])
      if (!(await exists(join(dist, file)))) fail(`missing release artifact: dist/${file}`);
    try {
      await assertAgentSkillsRelease({ root, dist });
    } catch (error) {
      fail(`Agent Skills: ${error.message}`);
    }
    try {
      await assertApiCatalogRelease({ root, dist });
    } catch (error) {
      fail(`API catalog: ${error.message}`);
    }
    try {
      await assertDiscoveryBoundaryRelease({ root, dist });
    } catch (error) {
      fail(`Discovery boundaries: ${error.message}`);
    }
    if (await exists(join(dist, RSS_PATH.replace(/^\//, "")))) {
      try {
        const rssBody = await read(join(dist, RSS_PATH.replace(/^\//, "")));
        assertRssJoin(rssBody, postRecords);
        const expectedRss = buildRssFeed(postRecords);
        if (rssBody !== expectedRss) {
          fail(`dist${RSS_PATH} does not match registry-driven RSS output; run node scripts/generate-rss.mjs`);
        }
        const publicRssPath = join(root, `public${RSS_PATH}`);
        if (await exists(publicRssPath)) {
          const publicRss = await read(publicRssPath);
          if (publicRss !== rssBody) fail(`public${RSS_PATH} and dist${RSS_PATH} must match`);
        }
      } catch (error) {
        fail(`RSS feed: ${error.message}`);
      }
    }
    if (await exists(join(dist, "llms.txt"))) {
      try {
        const llmsBody = await read(join(dist, "llms.txt"));
        const artifactRoutes = htmlArtifacts
          .map((artifact) => {
            if (artifact === "index.html") return "/";
            if (artifact.endsWith("/index.html"))
              return `/${artifact.slice(0, -"/index.html".length)}`;
            return undefined;
          })
          .filter(Boolean);
        const sitemapRoutes = (await exists(join(dist, "sitemap.xml")))
          ? parseSitemapXml(await read(join(dist, "sitemap.xml"))).map((entry) =>
              entry.loc.slice(CANONICAL_ORIGIN.length),
            )
          : [];
        const discoveryRoutes = deriveDiscoveryRoutes({
          artifactRoutes: [...artifactRoutes, RSS_PATH, "/sitemap.xml"],
          sitemapRoutes,
        });
        assertLlmsJoin(llmsBody, universities, { affiliationBoundary, discoveryRoutes });
        const expectedPacket = buildLlmsPacket(universities, {
          affiliationBoundary,
          discoveryRoutes,
        });
        if (llmsBody !== expectedPacket) {
          fail(
            "dist/llms.txt does not match registry-driven buildLlmsPacket output; run node scripts/generate-llms.mjs",
          );
        }
        const publicLlmsPath = join(root, "public/llms.txt");
        if (await exists(publicLlmsPath)) {
          const publicLlms = await read(publicLlmsPath);
          if (publicLlms !== llmsBody) {
            fail("public/llms.txt and dist/llms.txt must match the same registry-driven packet");
          }
        }
      } catch (error) {
        fail(`llms.txt: ${error.message}`);
      }
    }
    // Optional companion must not undercut the primary packet when present.
    if (await exists(join(dist, "llms-full.txt"))) {
      try {
        assertLlmsJoin(await read(join(dist, "llms-full.txt")), universities, {
          affiliationBoundary,
        });
      } catch (error) {
        fail(`llms-full.txt: ${error.message}`);
      }
    }
    if (await exists(join(dist, "CNAME"))) {
      const cname = await read(join(dist, "CNAME"));
      if (cname.charCodeAt(0) === 0xfeff || cname !== "vuzora.ru\n")
        fail("dist/CNAME must be UTF-8 and contain exactly one vuzora.ru line");
    }
    if (
      (await exists(join(dist, ".nojekyll"))) &&
      (await readFile(join(dist, ".nojekyll"))).length !== 0
    )
      fail("dist/.nojekyll must be empty");
    if (await exists(join(dist, "pages.json"))) fail("dist/pages.json must not be uploaded");
    if (await exists(join(dist, "server"))) fail("dist/server must not be uploaded");
    let homepage;
    try {
      homepage = parseHtmlDocument(await read(join(dist, artifactFor("/"))));
    } catch (error) {
      fail(`homepage parse failed: ${error.message}`);
    }
    if ((await exists(join(dist, "404.html"))) && homepage) {
      try {
        assertIndependent404(
          parseHtmlDocument(await read(join(dist, "404.html"))),
          routes,
          universities,
          homepage,
        );
      } catch (error) {
        fail(error.message);
      }
    }
    if (await exists(join(dist, "robots.txt"))) {
      const robots = await read(join(dist, "robots.txt"));
      if ((robots.match(/^Sitemap:\s*https:\/\/vuzora\.ru\/sitemap\.xml$/gim) ?? []).length !== 1)
        fail("robots.txt must expose exactly one canonical sitemap directive");
      if (/Sitemap:\s*https?:\/\/(?!vuzora\.ru)/i.test(robots))
        fail("robots.txt must not expose an alternate-origin sitemap directive");
      // Shared Policy: Disallow: /api/ does not block public indexable routes.
      for (const route of routes) {
        if (route.startsWith("/api")) fail(`robots policy blocks indexable route ${route}`);
      }
      if (!/^User-agent:\s*\*/im.test(robots)) fail("robots.txt must declare a User-agent rule");
      if (ANALYTICS_RE.test(robots)) fail("robots.txt must not reference analytics collectors");
      try {
        assertRobotsPolicy(robots);
      } catch (error) {
        fail(error.message);
      }
      try {
        assertRobotsAllowsLlms(robots, "/llms.txt");
      } catch (error) {
        fail(error.message);
      }
      const publicRobotsPath = join(root, "public/robots.txt");
      if (await exists(publicRobotsPath)) {
        const publicRobots = await read(publicRobotsPath);
        if (publicRobots !== robots)
          fail("public/robots.txt and dist/robots.txt must match the authoritative policy");
      }
    }
    // First-party public artifact scan for analytics integrations (HTML/JS/CSS/robots/CSP).
    if (await exists(dist)) {
      const files = await htmlFiles(dist);
      for (const path of files) {
        try {
          const body = await read(path);
          if (ANALYTICS_RE.test(body))
            fail(`analytics or collector reference found in ${relative(dist, path)}`);
        } catch (error) {
          fail(`artifact scan failed for ${relative(dist, path)}: ${error.message}`);
        }
      }
      // Scan CSS/JS assets under dist/assets for collector endpoints.
      try {
        const assetDir = join(dist, "assets");
        if (await exists(assetDir)) {
          const assets = await readdir(assetDir);
          for (const name of assets) {
            if (!/\.(js|css|html|txt|xml|json)$/i.test(name)) continue;
            const body = await read(join(assetDir, name));
            // React minifiers can produce the substring "gtag" inside unrelated symbols;
            // require a real collector/domain token rather than bare 4-letter coincidence.
            if (
              /\b(?:plausible\.io|google-analytics|googletagmanager\.com|yandex(?:\.ru)?\/metrika|mc\.yandex|metrika\.yandex|hotjar\.com|segment\.com|fullstory\.com|mixpanel\.com|amplitude\.com)\b/i.test(
                body,
              )
            )
              fail(`analytics collector domain found in assets/${name}`);
          }
        }
      } catch (error) {
        fail(`asset analytics scan failed: ${error.message}`);
      }
    }
    if (await exists(join(dist, "sitemap.xml"))) {
      try {
        assertSitemap(
          await read(join(dist, "sitemap.xml")),
          routes,
          (artifact) => routeArtifacts.has(artifact),
          true,
        );
      } catch (error) {
        fail(error.message);
      }
    }
  }
  if (failures.length)
    throw new Error(
      `Release validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`,
    );
  return { routes, universities, posts };
}
