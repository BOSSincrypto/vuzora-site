import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { artifactFor, buildRoutes, readRegistry } from "./route-policy.mjs";

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
  const { affiliationBoundary } = await readRegistry(root);
  assert.match(source, /export function universityDetailTitle/);
  assert.match(source, /export function universityDetailDescription/);
  assert.match(source, /AFFILIATION_BOUNDARY/);
  assert.match(source, /Сервис не является официальным сервисом вуза/);
  assert.equal(affiliationBoundary, "Сервис не является официальным сервисом вуза");
  // Title candidates prefer full name then code+city when length overflows.
  assert.match(source, /Расписание \$\{university\.name\}/);
  assert.match(source, /Расписание \$\{university\.code\} · \$\{university\.city\}/);
  assert.match(source, /Расписание пар \$\{university\.name\}/);
  const route = await readFile(join(root, "src/routes/unis_.$slug.tsx"), "utf8");
  assert.match(route, /universityDetailTitle/);
  assert.match(route, /universityDetailDescription/);
  assert.match(route, /AFFILIATION_BOUNDARY/);
  assert.match(route, /CollegeOrUniversity/);
  assert.match(route, /serviceType/);
  assert.match(route, /#breadcrumb/);
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
  assert.match(route, /Расписание \{university\.name\} в Telegram/);
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
