/**
 * Inline `[[href|label]]` markup shared by blog posts and legal documents.
 *
 * Content modules stay plain data — no JSX, no HTML — so the same paragraph
 * can be rendered into React here and into Markdown by
 * `scripts/markdown-mirrors.mjs`. One parser, two surfaces: a link that only
 * exists in one of them is a bug, not a formatting choice.
 *
 * Telegram destinations carry the semantic `data-cta` marker the release
 * validator requires. The mapping is derived from the href for the same reason
 * the validator derives it: an author writing a link should not have to
 * remember a marker name that is already implied by where the link points.
 *
 * @module lib/rich-text
 */

import type { ReactNode } from "react";
import { LINKS } from "@/content/site";

/** `[[href|label]]` — href first so a label containing `|` stays impossible. */
export const RICH_TEXT_LINK_RE = /\[\[([^\]|]+)\|([^\]]+)\]\]/g;

const UNIVERSITY_CTA_RE = /^https:\/\/t\.me\/vuzora_bot\?start=from-site_[a-z0-9-]+$/;

/**
 * Semantic CTA marker for a Telegram destination, or `undefined` for anything
 * else. Mirrors `expectedMarkerForHref` in `scripts/release-validator.mjs`.
 */
export function telegramCtaMarker(href: string): string | undefined {
  if (href === LINKS.genericBotUrl) return "generic-conversion";
  if (href === LINKS.supportBotUrl) return "support";
  if (href === LINKS.botUrl) return "bot-navigation";
  if (UNIVERSITY_CTA_RE.test(href)) return "university-conversion";
  return undefined;
}

/** External http(s) links open in a new tab with the safe rel pair. */
function isExternalHttp(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

/**
 * Render one paragraph of rich text.
 *
 * @param text Paragraph source, possibly containing `[[href|label]]` tokens.
 * @param linkClassName Class applied to every rendered link.
 */
export function renderRichText(text: string, linkClassName: string): ReactNode {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let linkIndex = 0;

  for (const match of text.matchAll(RICH_TEXT_LINK_RE)) {
    const [token, href, label] = match;
    const start = match.index ?? 0;
    if (start > cursor) nodes.push(text.slice(cursor, start));
    const external = isExternalHttp(href);
    nodes.push(
      <a
        key={`${href}-${linkIndex}`}
        href={href}
        className={linkClassName}
        data-cta={telegramCtaMarker(href)}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
      >
        {label}
      </a>,
    );
    cursor = start + token.length;
    linkIndex += 1;
  }

  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}
