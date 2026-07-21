import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { artifactFor, buildRoutes, readRegistry } from "./route-policy.mjs";
import { runPinnedBun } from "./run-bun-test.mjs";

const root = process.cwd();
const SLUG_RE = /^[a-z0-9-]+$/;

test("every university has a unique stable ASCII slug and registry fields", async () => {
  const { universities } = await readRegistry(root);
  assert.equal(universities.length, 25);
  const slugs = new Set();
  for (const university of universities) {
    assert.ok(university.slug, `missing slug for ${university.code ?? university.name}`);
    assert.match(university.slug, SLUG_RE);
    assert.ok(!slugs.has(university.slug), `duplicate slug ${university.slug}`);
    slugs.add(university.slug);
    assert.ok(university.code);
    assert.ok(university.name);
    assert.ok(university.city);
    assert.match(university.status ?? "", /^(online|soon)$/);
  }
});

test("central helpers map slug to detail path and Telegram attribution", async () => {
  const source = await readFile(join(root, "src/content/universities.ts"), "utf8");
  assert.match(source, /export function findUniversity/);
  assert.match(source, /export function universityPagePath/);
  assert.match(source, /export function universityBotUrl/);
  assert.match(source, /export function statusLabel/);
  assert.match(source, /UNIVERSITY_STATUS_LABELS/);
  assert.match(source, /online:\s*"Онлайн"/);
  assert.match(source, /soon:\s*"Скоро"/);
  assert.match(source, /from-site_\$\{/);
  assert.match(source, /\/unis\/\$\{/);
});

test("prerender and artifact policy include every university detail route", async () => {
  const { universities, posts } = await readRegistry(root);
  const routes = buildRoutes({ universities, posts });
  const detailRoutes = universities.map((university) => `/unis/${university.slug}`);
  for (const route of detailRoutes) {
    assert.ok(routes.includes(route), `missing prerender seed ${route}`);
    assert.equal(artifactFor(route), `unis/${route.slice("/unis/".length)}/index.html`);
  }
  assert.equal(detailRoutes.length, universities.length);
});

test("registry omits guessed official URLs and keeps optional field explicit", async () => {
  const source = await readFile(join(root, "src/content/universities.ts"), "utf8");
  assert.match(source, /officialUrl\?:\s*string/);
  // Any non-empty officialUrl must be an absolute https URL in the registry object form.
  const { universities } = await readRegistry(root);
  let verified = 0;
  let omitted = 0;
  for (const university of universities) {
    if (university.officialUrl) {
      verified += 1;
      assert.match(university.officialUrl, /^https:\/\/[^\s"']+\/?$/);
    } else {
      omitted += 1;
    }
  }
  // Verified subset is intentional; omission remains valid product behavior.
  assert.ok(verified >= 20, `expected verified official URLs, found ${verified}`);
  assert.ok(omitted >= 1, "at least one omitted officialUrl keeps the absent matrix testable");
});

test("detail route module exists and rejects unknown slugs", async () => {
  const source = await readFile(join(root, "src/routes/unis_.$slug.tsx"), "utf8");
  // Flat-route file id is `/unis_/$slug`; public path remains `/unis/$slug`.
  assert.match(source, /createFileRoute\("\/unis_\/\$slug"\)/);
  assert.match(source, /notFound\(\)/);
  assert.match(source, /findUniversity/);
  assert.match(source, /<header data-identity-status>/);
  assert.match(
    source,
    /<\/header>\s*\n\s*<CtaButton[\s\S]*data-cta="university-conversion"[\s\S]*<\/CtaButton>\s*\n\s*<div\s*\n\s*data-detail-content/,
  );
  assert.match(source, /data-detail-content/);
  assert.match(source, /data-cta="university-conversion"/);
  assert.match(source, /href="\/unis"/);
  assert.match(source, /CollegeOrUniversity/);
  assert.match(source, /#university/);
  assert.match(source, /#service/);
  assert.match(source, /"@type": "FAQPage"/);
  assert.match(source, /universityFaq\(university\)/);
  assert.match(source, /sameAs: university\.officialUrl/);
  assert.match(source, /university\.officialUrl \? \(/);
});

test("directory surface links each supported university name", async () => {
  const source = await readFile(join(root, "src/components/vuzora/Universities.tsx"), "utf8");
  assert.match(source, /href=\{href\}/);
  assert.match(source, /universityPagePath/);
  assert.match(source, /statusLabel/);
});

test("detail metadata helpers emit bounded unique Russian titles and descriptions", async () => {
  const source = await readFile(join(root, "src/content/universities.ts"), "utf8");
  const { affiliationBoundary, universities } = await readRegistry(root);
  assert.match(source, /export function universityDetailTitle/);
  assert.match(source, /export function universityDetailDescription/);
  assert.match(source, /AFFILIATION_BOUNDARY/);
  assert.match(source, /Сервис не является официальным сервисом вуза/);
  assert.equal(affiliationBoundary, "Сервис не является официальным сервисом вуза");
  // Title candidates always keep the full registry name; no code-only fallback.
  assert.match(source, /Расписание \$\{name\}/);
  assert.match(source, /\$\{name\}: расписание в Telegram/);
  assert.match(source, /\$\{name\}\$\{brand\}/);
  assert.match(source, /candidate\.includes\(name\)/);
  assert.doesNotMatch(
    source,
    /Расписание \$\{university\.code\} · \$\{university\.city\}/,
    "code+city title fallback omits the full registry name",
  );
  assert.doesNotMatch(
    source,
    /Расписание \$\{university\.code\} в Telegram/,
    "code-only Telegram title fallback omits the full registry name",
  );
  assert.match(source, /Расписание пар \$\{university\.name\}/);
  // Registry names themselves must fit the title bound so name-only titles work.
  for (const university of universities) {
    assert.ok(
      university.name && university.name.length >= 10 && university.name.length <= 70,
      `registry name for ${university.slug} must be 10–70 chars (got ${university.name?.length})`,
    );
  }
  const route = await readFile(join(root, "src/routes/unis_.$slug.tsx"), "utf8");
  assert.match(route, /universityDetailTitle/);
  assert.match(route, /universityDetailDescription/);
  assert.match(route, /AFFILIATION_BOUNDARY/);
  assert.match(route, /CollegeOrUniversity/);
  assert.match(route, /serviceType/);
  assert.match(route, /#breadcrumb/);
});

test("every detail title includes the full registry name within 10–70 chars", async () => {
  const { spawnSync } = await import("node:child_process");
  const script = `
import { UNIVERSITIES, universityDetailTitle, universityDetailDescription } from "./src/content/universities.ts";
const TITLE_MIN = 10, TITLE_MAX = 70, DESC_MIN = 50, DESC_MAX = 170;
const titles = new Set();
const descriptions = new Set();
for (const u of UNIVERSITIES) {
  const title = universityDetailTitle(u);
  const description = universityDetailDescription(u);
  if (!title.includes(u.name)) {
    console.error("TITLE_OMITS_NAME", u.slug, title);
    process.exit(2);
  }
  if (title.length < TITLE_MIN || title.length > TITLE_MAX) {
    console.error("TITLE_BOUNDS", u.slug, title.length, title);
    process.exit(3);
  }
  // Reject code-only titles that mention the code but not the full name (already covered),
  // and reject titles that are only the bare code with brand/city.
  const codeOnly = new RegExp(\`^Расписание \${u.code.replace(/[.*+?^\${}()|[\\]\\\\]/g, "\\\\$&")}(?: · | в | – )\`);
  if (codeOnly.test(title) && !title.includes(u.name)) {
    console.error("TITLE_CODE_ONLY", u.slug, title);
    process.exit(4);
  }
  if (!description.includes(u.name) || description.length < DESC_MIN || description.length > DESC_MAX) {
    console.error("DESCRIPTION", u.slug, description.length, description);
    process.exit(5);
  }
  if (titles.has(title)) {
    console.error("DUP_TITLE", title);
    process.exit(6);
  }
  if (descriptions.has(description)) {
    console.error("DUP_DESCRIPTION", description);
    process.exit(7);
  }
  titles.add(title);
  descriptions.add(description);
  console.log(JSON.stringify({ slug: u.slug, title, titleLen: title.length }));
}
console.log("OK", UNIVERSITIES.length);
`;
  const result = spawnSync("npx", ["--yes", "bun@1.3.14", "-e", script], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /OK 25/);
});

test("detail content exposes query intent, required sections, and registry FAQ helper", async () => {
  const content = await readFile(join(root, "src/content/universities.ts"), "utf8");
  const route = await readFile(join(root, "src/routes/unis_.$slug.tsx"), "utf8");
  const directory = await readFile(join(root, "src/routes/unis.tsx"), "utf8");
  const policy = await readFile(join(root, "scripts/route-policy.mjs"), "utf8");
  const validator = await readFile(join(root, "scripts/release-validator.mjs"), "utf8");
  assert.match(content, /export type UniversityFaq/);
  assert.match(content, /export function universityFaq/);
  assert.match(content, /Как подключить расписание \$\{university\.code\} в Telegram/);
  assert.match(content, /export function universityGenitiveName/);
  assert.match(route, /universityGenitiveName/);
  assert.match(route, /Расписание \{genitiveName\} в Telegram/);
  assert.match(route, /\{university\.name\}/);
  for (const marker of ["connect", "morning-delivery", "status-city", "affiliation", "faq"]) {
    assert.match(route, new RegExp(`data-section=\\"${marker}\\"`));
  }
  assert.match(route, /<details className=/);
  assert.match(route, /<summary className=/);
  assert.match(policy, /"FAQPage"/);
  assert.match(validator, /FAQPage Q&A does not match visible FAQ/);
  assert.match(validator, /sameAs must equal the registry officialUrl/);
  assert.match(directory, /утреннюю доставку/);
  assert.match(directory, /AFFILIATION_BOUNDARY/);
});

test("university FAQ framing varies by city cluster", async () => {
  const script = `
import { UNIVERSITIES, universityFaq } from "./src/content/universities.ts";

const bySlug = (slug) => UNIVERSITIES.find((university) => university.slug === slug);
const faqFor = (slug) => {
  const university = bySlug(slug);
  if (!university) throw new Error("missing fixture university " + slug);
  return universityFaq(university);
};
const capitalFaq = faqFor("msu");
const regionalFaq = faqFor("spbu");
const multiCampusFaq = faqFor("hse");
const allFaq = UNIVERSITIES.map((university) => universityFaq(university));

if (!capitalFaq.some((item) => item.question.startsWith("Когда приходит расписание"))) {
  throw new Error("capital FAQ lost its delivery-time framing");
}
if (!regionalFaq.some((item) => item.question.startsWith("Что проверить перед подключением"))) {
  throw new Error("regional FAQ lacks its city-check framing");
}
if (!multiCampusFaq.some((item) => item.question.startsWith("Как учитывать несколько городов"))) {
  throw new Error("multi-campus FAQ lacks its multi-city framing");
}
for (const faq of allFaq) {
  if (faq.length < 3 || faq.length > 5) throw new Error("FAQ count outside 3–5");
  if (new Set(faq.map((item) => item.question)).size !== faq.length) {
    throw new Error("FAQ questions must be unique within each university");
  }
  if (faq.some((item) => !item.question.trim() || !item.answer.trim())) {
    throw new Error("FAQ questions and answers must be non-empty");
  }
}
console.log("OK FAQ clusters");
`;
  const result = runPinnedBun(script);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /OK FAQ clusters/);
});

test("Russian schedule copy uses genitive university names without changing registry identity", async () => {
  const { spawnSync } = await import("node:child_process");
  const script = `
import { UNIVERSITIES, universityFaq, universityGenitiveName } from "./src/content/universities.ts";

const expected = {
  "msu": "Московского государственного университета им. М. В. Ломоносова",
  "spbu": "Санкт-Петербургского государственного университета",
  "hse": "Национального исследовательского университета «Высшая школа экономики»",
  "sinergiya": "Университета «Синергия»",
};
for (const [slug, genitive] of Object.entries(expected)) {
  const university = UNIVERSITIES.find((item) => item.slug === slug);
  if (!university) throw new Error("missing fixture university " + slug);
  if (universityGenitiveName(university) !== genitive) {
    throw new Error("unexpected genitive form for " + slug);
  }
  if (university.name === genitive) {
    throw new Error("registry display name must remain nominative for " + slug);
  }
  const faq = universityFaq(university);
  if (slug === "msu" || slug === "sinergiya") {
    if (!faq.some((item) => item.question.includes("расписание " + genitive))) {
      throw new Error("schedule FAQ does not use genitive form for " + slug);
    }
    if (!faq.some((item) => item.answer.includes("Для " + genitive))) {
      throw new Error("FAQ answer does not use genitive form for " + slug);
    }
  } else if (slug === "spbu") {
    if (!faq.some((item) => item.answer.includes("название " + genitive))) {
      throw new Error("regional FAQ does not use genitive form for " + slug);
    }
  } else if (!faq.some((item) => item.answer.includes("каналах " + genitive))) {
    throw new Error("multi-campus FAQ does not use genitive form for " + slug);
  }
}
for (const university of UNIVERSITIES) {
  if (!universityGenitiveName(university).trim()) {
    throw new Error("empty genitive name for " + university.slug);
  }
}
console.log("OK Russian genitive copy");
`;
  const result = spawnSync("npx", ["--yes", "bun@1.3.14", "-e", script], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /OK Russian genitive copy/);
});

test("Telegram conversion classes remain distinct and exact", async () => {
  const site = await readFile(join(root, "src/content/site.ts"), "utf8");
  assert.match(site, /genericBotUrl:\s*"https:\/\/t\.me\/vuzora_bot\?start=from-site"/);
  assert.match(site, /botUrl:\s*"https:\/\/t\.me\/vuzora_bot"/);
  assert.match(site, /supportBotUrl:\s*"https:\/\/t\.me\/vuzora_support_bot"/);
  const unis = await readFile(join(root, "src/content/universities.ts"), "utf8");
  assert.match(unis, /from-site_\$\{slug\}|from-site_\$\{/);
  // Homepage generic conversion anchors stay generic; detail uses university class.
  const hero = await readFile(join(root, "src/components/vuzora/Hero.tsx"), "utf8");
  assert.match(hero, /data-cta="generic-conversion"/);
  assert.match(hero, /LINKS\.genericBotUrl/);
  const detail = await readFile(join(root, "src/routes/unis_.$slug.tsx"), "utf8");
  assert.match(detail, /data-cta="university-conversion"/);
  const support = await readFile(join(root, "src/components/vuzora/Universities.tsx"), "utf8");
  assert.match(support, /data-cta="support"/);
  const footer = await readFile(join(root, "src/components/vuzora/Footer.tsx"), "utf8");
  assert.match(footer, /data-cta="bot-navigation"/);
});

test("production stack remains analytics-free and CSP has no collector hosts", async () => {
  const start = await readFile(join(root, "src/start.ts"), "utf8");
  assert.match(start, /Content-Security-Policy/);
  assert.doesNotMatch(start, /plausible|google-analytics|googletagmanager|metrika|mc\.yandex/i);
  assert.doesNotMatch(start, /script-src[^"]*https?:\/\//i);
  const rootRoute = await readFile(join(root, "src/routes/__root.tsx"), "utf8");
  assert.doesNotMatch(rootRoute, /plausible|google-analytics|metrika|gtag\(/i);
  const index = await readFile(join(root, "src/routes/index.tsx"), "utf8");
  assert.doesNotMatch(index, /plausible|analytics\.js|gtag\(/i);
});
