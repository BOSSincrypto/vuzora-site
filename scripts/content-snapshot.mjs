/**
 * Real values from `src/content/*.ts`, for scripts that cannot import TypeScript.
 *
 * `route-policy.mjs` reads the registry with regexes, which is enough for
 * slugs and titles but cannot reach a blog body, a FAQ helper, or a legal
 * section — the Markdown mirrors need all three. Bun is already the pinned
 * toolchain and imports the modules directly, so the mirrors are generated
 * from the same values the pages render, not from a second parse of the
 * source that could disagree with it.
 *
 * @module scripts/content-snapshot
 */

import { runPinnedBun } from "./run-bun-test.mjs";

const SNAPSHOT_SOURCE = `
import { BRAND, SITE_URL, LINKS } from "./src/content/site.ts";
import { FAQ } from "./src/content/faq.ts";
import {
  PLANS,
  TIMELINE,
  INCLUDED,
  CARRY_OVER_NOTE,
  REFUND_NOTE,
  formatPrice,
  pricingFacts,
} from "./src/content/pricing.ts";
import { CHANGELOG, formatEntryDate } from "./src/content/changelog.ts";
import { POSTS, BLOG_INDEX_PATH, blogPostPath, formatPostDate } from "./src/content/blog.ts";
import { LEGAL_DOCUMENTS } from "./src/content/legal.ts";
import { markdownMirrorPath } from "./src/content/seo.ts";
import {
  AFFILIATION_BOUNDARY,
  UNIVERSITIES,
  scheduleSourceHost,
  statusLabel,
  universityBotUrl,
  universityDetailCopy,
  universityDetailDescription,
  universityDetailTitle,
  universityFaq,
  universityGenitiveName,
  universityLeadSentence,
  universityPagePath,
} from "./src/content/universities.ts";

const snapshot = {
  site: {
    name: BRAND.name,
    tagline: BRAND.tagline,
    email: BRAND.email,
    url: SITE_URL,
    legal: { ...BRAND.legal },
    links: { ...LINKS },
  },
  affiliationBoundary: AFFILIATION_BOUNDARY,
  blogIndexPath: BLOG_INDEX_PATH,
  faq: FAQ.map((entry) => ({ question: entry.q, answer: entry.a })),
  pricing: {
    plans: PLANS.map((plan) => ({
      id: plan.id,
      period: plan.period,
      price: plan.price,
      priceLabel: formatPrice(plan.price),
      hint: plan.hint,
      featured: Boolean(plan.featured),
    })),
    timeline: TIMELINE.map((entry) => ({ ...entry })),
    included: [...INCLUDED],
    carryOver: CARRY_OVER_NOTE,
    refund: REFUND_NOTE,
    facts: [...pricingFacts()],
  },
  changelog: CHANGELOG.map((entry) => ({
    date: entry.date,
    dateLabel: formatEntryDate(entry.date),
    tag: entry.tag,
    title: entry.title,
    bullets: [...entry.bullets],
  })),
  posts: POSTS.map((post) => ({
    slug: post.slug,
    title: post.title,
    date: post.date,
    dateLabel: formatPostDate(post.date),
    summary: post.summary,
    readingTime: post.readingTime,
    universitySlug: post.universitySlug ?? null,
    body: [...post.body],
    path: blogPostPath(post.slug),
    mirrorPath: markdownMirrorPath(blogPostPath(post.slug)),
  })),
  legal: LEGAL_DOCUMENTS.map((document) => ({
    path: document.path,
    mirrorPath: markdownMirrorPath(document.path),
    heading: document.heading,
    title: document.title,
    description: document.description,
    revision: document.revision,
    sections: document.sections.map((section) => ({
      title: section.title,
      blocks: section.blocks.map((block) =>
        block.kind === "p"
          ? { kind: "p", text: block.text }
          : { kind: "ul", items: [...block.items] },
      ),
    })),
  })),
  universities: UNIVERSITIES.map((university) => ({
    slug: university.slug,
    code: university.code,
    name: university.name,
    shortName: university.shortName ?? null,
    city: university.city,
    status: university.status,
    statusLabel: statusLabel(university.status),
    officialUrl: university.officialUrl ?? null,
    scheduleUrl: university.scheduleUrl ?? null,
    scheduleHost: scheduleSourceHost(university),
    genitiveName: universityGenitiveName(university),
    title: universityDetailTitle(university),
    description: universityDetailDescription(university),
    lead: universityLeadSentence(university),
    copy: universityDetailCopy(university),
    faq: universityFaq(university).map((entry) => ({
      question: entry.question,
      answer: entry.answer,
    })),
    path: universityPagePath(university.slug),
    mirrorPath: markdownMirrorPath(universityPagePath(university.slug)),
    botUrl: universityBotUrl(university.slug),
  })),
};

process.stdout.write(JSON.stringify(snapshot));
`;

/**
 * Load every content value the Markdown mirrors are built from.
 *
 * @param {string} [root] Project root; defaults to the working directory.
 */
export function readContentSnapshot(root = process.cwd()) {
  const result = runPinnedBun(SNAPSHOT_SOURCE, { cwd: root });
  if (result.status !== 0) {
    throw new Error(
      `content snapshot failed under Bun: ${result.stderr || result.stdout || result.error?.code}`,
    );
  }
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error(`content snapshot is not valid JSON: ${result.stdout.slice(0, 200)}`);
  }
}
